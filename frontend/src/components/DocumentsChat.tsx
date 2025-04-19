import React, { useEffect, useState } from "react";
import ChatInput from "./ChatInput";
import ChatMessages from "./ChatMessages";
import { askQuestion, createConversation, getMessages } from "../services/conversationService";
import { uploadDocuments } from "../services/documentService";
import { Message } from "../interfaces/interfaces";

const DocumentsChat: React.FC = () => {
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<Message[]>([]);

  const loadMessages = async (convId: string) => {
    try {
      const fetched = await getMessages(convId);
      setMessages(
        fetched.map((m: any, index: number) => ({
          id: index,
          text: m.content,
          sender: m.role === "assistant" ? "bot" : "user"
        }))
      );
    } catch (error) {
      console.error("Erreur chargement messages :", error);
    }
  };

  useEffect(() => {
    if (conversationId) loadMessages(conversationId);
  }, [conversationId]);

  // Mise à jour pour accepter un tableau de fichiers
  const handleSend = async (userMessage: string, files: File[]) => {
    const convType = "doc";
    // Si des fichiers sont sélectionnés, on les upload
    if (files.length > 0) {
      try {
        const result = await uploadDocuments(files);
        setConversationId(result.conversationId);
      } catch (error) {
        console.error("Erreur upload documents :", error);
      }
      return;
    }
    // Création d'une nouvelle conversation
    if (!conversationId) {
      try {
        const newConv = await createConversation(userMessage, convType);
        setConversationId(newConv.conversationId);
        setMessages(prev => [
          ...prev, 
          { id: Date.now(), text: userMessage, sender: "user" },
          { id: Date.now() + 1, text: newConv.answer, sender: "bot" }
        ]);
        return;
      } catch (error) {
        console.error("Erreur création conv doc :", error);
        return;
      }
    }
    // Envoi dans une conversation existante
    try {
      const answer = await askQuestion(userMessage, conversationId, convType);
      setMessages(prev => [
        ...prev, 
        { id: Date.now(), text: userMessage, sender: "user" },
        { id: Date.now() + 1, text: answer, sender: "bot" }
      ]);
    } catch (error) {
      console.error("Erreur question doc :", error);
    }
  };

  return (
    <div>
      <h2>Chat sur Documents</h2>
      <ChatMessages messages={messages} />
      <ChatInput onSend={handleSend} />
    </div>
  );
};

export default DocumentsChat;
