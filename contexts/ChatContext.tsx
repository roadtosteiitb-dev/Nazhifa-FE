import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { ChatRepository, Conversation, Message } from "../services/chatService";

export { Conversation, Message };

interface ChatContextType {
  conversations: Conversation[];
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
  markAsRead: (conversationId: string, role: "buyer" | "owner") => Promise<void>;
  getUnreadCountForUser: (userId: string, role: "buyer" | "owner", ownerName?: string) => number;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);

  const refreshConversations = useCallback(async () => {
    try {
      const data = await ChatRepository.getConversations();
      setConversations(data);
    } catch (error) {
      // Not logged in yet, or session expired — conversations simply stay empty.
      setConversations([]);
    }
  }, []);

  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  const getOrCreateConversation = async (params: Parameters<typeof ChatRepository.getOrCreateConversation>[0]) => {
    const conv = await ChatRepository.getOrCreateConversation(params);
    await refreshConversations();
    return conv;
  };

  const getMessagesForConversation = async (conversationId: string) => {
    return await ChatRepository.getMessages(conversationId);
  };

  const sendMessage = async (params: Parameters<typeof ChatRepository.postMessage>[0]) => {
    const msg = await ChatRepository.postMessage(params);
    await refreshConversations();
    return msg;
  };

  const markAsRead = async (conversationId: string, role: "buyer" | "owner") => {
    await ChatRepository.markAsRead(conversationId, role);
    await refreshConversations();
  };

  const getUnreadCountForUser = (userId: string, role: "buyer" | "owner", ownerName?: string) => {
    if (role === "buyer") {
      return conversations
        .filter((c) => c.buyerId === userId)
        .reduce((sum, c) => sum + (c.unreadBuyer || 0), 0);
    } else {
      return conversations
        .filter((c) => c.ownerId === userId || c.ownerName === ownerName || c.ownerName === userId)
        .reduce((sum, c) => sum + (c.unreadOwner || 0), 0);
    }
  };

  return (
    <ChatContext.Provider
      value={{
        conversations,
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
