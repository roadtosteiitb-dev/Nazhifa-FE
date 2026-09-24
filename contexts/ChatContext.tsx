import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { AppState } from "react-native";
import { ChatRepository, Conversation, Message } from "../services/chatService";
import { useAuth } from "./AuthContext";

export { Conversation, Message };

/** How often the conversation list refreshes while the app is in the foreground */
const LIST_POLL_MS = 15000;

interface ChatContextType {
  conversations: Conversation[];
  /** true until the first conversation fetch for the current user finished */
  isLoadingConversations: boolean;
  /** unread messages for the logged-in user across all conversations */
  totalUnread: number;
  refreshConversations: () => Promise<void>;
  getOrCreateConversation: (params: {
    buyerId: string;
    buyerName: string;
    ownerId: string;
    ownerName: string;
    propertyId: string;
    propertyTitle: string;
    propertyImage: string;
    propertyPrice: number;
    propertyLocation: string;
    propertyStatus: string;
  }) => Promise<Conversation>;
  getMessagesForConversation: (conversationId: string) => Promise<Message[]>;
  sendMessage: (params: {
    conversationId: string;
    senderId: string;
    senderRole: "buyer" | "owner";
    senderName: string;
    text: string;
  }) => Promise<Message>;
  /** role is kept for backwards compatibility — the backend derives it */
  markAsRead: (conversationId: string, role?: "buyer" | "owner") => Promise<void>;
  getUnreadCountForUser: (userId: string, role: "buyer" | "owner", ownerName?: string) => number;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = user?.id ?? null;

  const refreshConversations = useCallback(async () => {
    if (!userIdRef.current) {
      setConversations([]);
      setIsLoadingConversations(false);
      return;
    }
    try {
      const data = await ChatRepository.getConversations();
      setConversations(data);
    } catch {
      // Network hiccup / expired session — keep the last known list
    } finally {
      setIsLoadingConversations(false);
    }
  }, []);

  // Reload whenever the logged-in user changes (login, logout, switching account)
  useEffect(() => {
    setConversations([]);
    setIsLoadingConversations(!!user);
    refreshConversations();
  }, [user?.id, refreshConversations]);

  // Keep the list (and unread badges) fresh while the app is open
  useEffect(() => {
    if (!user) return;
    let timer: ReturnType<typeof setInterval> | null = setInterval(refreshConversations, LIST_POLL_MS);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        refreshConversations();
        if (!timer) timer = setInterval(refreshConversations, LIST_POLL_MS);
      } else if (timer) {
        clearInterval(timer);
        timer = null;
      }
    });
    return () => {
      if (timer) clearInterval(timer);
      sub.remove();
    };
  }, [user?.id, refreshConversations]);

  const totalUnread = useMemo(() => {
    if (!user) return 0;
    return conversations.reduce(
      (sum, c) => sum + (c.ownerId === user.id ? c.unreadOwner || 0 : c.buyerId === user.id ? c.unreadBuyer || 0 : 0),
      0
    );
  }, [conversations, user]);

  // All actions are memoised so screens can safely list them as effect dependencies
  const getOrCreateConversation = useCallback(async (params: Parameters<typeof ChatRepository.getOrCreateConversation>[0]) => {
    const conv = await ChatRepository.getOrCreateConversation(params);
    // Make it available to the chat room immediately, then sync the full list
    setConversations((prev) => (prev.some((c) => c.id === conv.id) ? prev : [conv, ...prev]));
    refreshConversations();
    return conv;
  }, [refreshConversations]);

  const getMessagesForConversation = useCallback(
    (conversationId: string) => ChatRepository.getMessages(conversationId),
    []
  );

  const sendMessage = useCallback(async (params: Parameters<typeof ChatRepository.postMessage>[0]) => {
    const msg = await ChatRepository.postMessage(params);
    // Optimistically bump the conversation to the top of the list
    setConversations((prev) => {
      const conv = prev.find((c) => c.id === params.conversationId);
      if (!conv) return prev;
      const updated = { ...conv, lastMessage: msg.text, lastMessageTime: msg.time, updatedAt: msg.createdAt };
      return [updated, ...prev.filter((c) => c.id !== conv.id)];
    });
    return msg;
  }, []);

  const markAsRead = useCallback(async (conversationId: string) => {
    const me = userIdRef.current;
    // Clear the badge right away (only touch state if there was something unread)
    setConversations((prev) => {
      const conv = prev.find((c) => c.id === conversationId);
      if (!conv) return prev;
      const mine = conv.buyerId === me ? "unreadBuyer" : conv.ownerId === me ? "unreadOwner" : null;
      if (!mine || !conv[mine]) return prev;
      return prev.map((c) => (c.id === conversationId ? { ...c, [mine]: 0 } : c));
    });
    try {
      await ChatRepository.markAsRead(conversationId);
    } catch {}
  }, []);

  const getUnreadCountForUser = (userId: string, role: "buyer" | "owner", ownerName?: string) => {
    if (role === "buyer") {
      return conversations
        .filter((c) => c.buyerId === userId)
        .reduce((sum, c) => sum + (c.unreadBuyer || 0), 0);
    }
    return conversations
      .filter((c) => c.ownerId === userId || c.ownerName === ownerName)
      .reduce((sum, c) => sum + (c.unreadOwner || 0), 0);
  };

  return (
    <ChatContext.Provider
      value={{
        conversations,
        isLoadingConversations,
        totalUnread,
        refreshConversations,
        getOrCreateConversation,
        getMessagesForConversation,
        sendMessage,
        markAsRead,
        getUnreadCountForUser,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
};
