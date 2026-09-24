/**
 * LOKATANI – ChatService (REST API via Axios)
 *
 * Migrasi dari AsyncStorage ke Express.js REST API.
 * Semua UI components menggunakan interface yang SAMA seperti sebelumnya —
 * tidak ada perubahan pada komponen UI.
 */
import api from "./apiClient";

export interface Conversation {
  id: string;
  propertyId: string;
  propertyTitle: string;
  propertyImage: string;
  propertyPrice: number;
  propertyLocation: string;
  propertyStatus: string;
  buyerId: string;
  buyerName: string;
  ownerId: string;
  ownerName: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadBuyer: number;
  unreadOwner: number;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: "buyer" | "owner";
  senderName: string;
  text: string;
  time: string;
  createdAt: string;
  status: "sent" | "read";
}

export const ChatRepository = {
  async getConversations(): Promise<Conversation[]> {
    const res = await api.get("/conversations");
    return res.data;
  },

  async getMessages(conversationId: string): Promise<Message[]> {
    const res = await api.get(`/conversations/${conversationId}/messages`);
    return res.data;
  },

  async getOrCreateConversation(params: {
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
  }): Promise<Conversation> {
    // Buyer = logged-in user and owner = property owner are resolved by the backend
    const res = await api.post("/conversations", { propertyId: params.propertyId });
    return res.data;
  },

  async postMessage(params: {
    conversationId: string;
    senderId: string;
    senderRole: "buyer" | "owner";
    senderName: string;
    text: string;
  }): Promise<Message> {
    // Sender role is derived by the backend from the conversation
    const res = await api.post(`/conversations/${params.conversationId}/messages`, {
      text: params.text,
    });
    return res.data;
  },

  async markAsRead(conversationId: string): Promise<void> {
    await api.put(`/conversations/${conversationId}/read`);
  },
};
