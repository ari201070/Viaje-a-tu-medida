import React, { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Bot, Send, User, Sparkles } from 'lucide-react';
import { useTripStore } from '../store/useTripStore';
import { GoogleGenAI } from '@google/genai';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
}

export default function AIAssistant() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const trip = useTripStore((state) => state.trips.find((t) => t.id === id));
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize chat context on mount
  useEffect(() => {
    if (messages.length === 0 && trip) {
      setMessages([
        {
          id: 'welcome',
          role: 'model',
          text: `¡Hola! Soy Gemini, tu asistente de viaje. Veo que estás planeando un viaje a **${trip.title}**. ¿En qué te puedo ayudar hoy? Puedo buscar eventos locales, sugerir restaurantes, o ayudarte a armar un itinerario para tus destinos.`
        }
      ]);
    }
  }, [trip, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!trip) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    setInput('');
    
    const newUserMsg: Message = { id: Date.now().toString(), role: 'user', text: userText };
    setMessages(prev => [...prev, newUserMsg]);
    setIsLoading(true);

    try {
      // Initialize Gemini API
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("API Key no configurada.");
      }

      const ai = new GoogleGenAI({ apiKey });
      
      // Build context
      const destinationsStr = trip.destinations?.map(d => d.name).join(', ') || 'ningún destino específico aún';
      const systemInstruction = `Eres un asistente de viajes experto. Estás ayudando a un usuario a planificar un viaje llamado "${trip.title}". Los destinos actuales son: ${destinationsStr}. Responde de manera concisa, útil y amigable. Si te preguntan por eventos o lugares, da ejemplos concretos.`;

      // Format history for Gemini (excluding the welcome message if needed, or just sending the whole text)
      // For simplicity, we'll just send the current prompt with context, or use the chat API.
      
      const chat = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction,
        }
      });

      // Send previous messages to establish history (simplified)
      // In a real app, we'd pass the history to the chat creation, but for now we just send the new message
      // since the chat instance doesn't persist across renders in this simple setup.
      // To make it better, we should send the whole conversation history.
      
      // We'll just generate content with the history formatted as text for this simple implementation
      let conversationText = systemInstruction + "\n\nHistorial de conversación:\n";
      messages.forEach(m => {
        if (m.id !== 'welcome') {
          conversationText += `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.text}\n`;
        }
      });
      conversationText += `Usuario: ${userText}\nAsistente:`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: conversationText,
        config: {
          tools: [{ googleSearch: {} }], // Enable search grounding for real-time info
        }
      });

      const modelText = response.text || "Lo siento, no pude generar una respuesta.";
      
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: modelText }]);
    } catch (error) {
      console.error("Error calling Gemini:", error);
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'model', 
        text: "Hubo un error al conectar con el asistente. Por favor, verifica tu conexión o la clave de API." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Simple markdown formatter for bold text
  const formatText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 shrink-0">
        <Link to={`/trip/${trip.id}`} className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2">
          <div className="bg-purple-100 p-2 rounded-lg">
            <Bot className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t('ai_assistant')}</h2>
            <p className="text-sm text-gray-500 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Powered by Gemini
            </p>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                msg.role === 'user' ? 'bg-indigo-100 text-indigo-600' : 'bg-purple-100 text-purple-600'
              }`}>
                {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
              </div>
              <div className={`max-w-[80%] rounded-2xl px-5 py-3 ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-tr-none' 
                  : 'bg-gray-100 text-gray-800 rounded-tl-none'
              }`}>
                <p className="whitespace-pre-wrap leading-relaxed">{formatText(msg.text)}</p>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex gap-4">
              <div className="shrink-0 w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                <Bot className="w-5 h-5" />
              </div>
              <div className="bg-gray-100 text-gray-500 rounded-2xl rounded-tl-none px-5 py-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <form onSubmit={handleSend} className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('ai_chat_placeholder')}
              className="w-full pl-4 pr-12 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none shadow-sm"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-2 p-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
