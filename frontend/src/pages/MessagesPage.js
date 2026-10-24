import React, { useContext } from 'react';
import { AuthContext } from '../App';
import { Navigate } from 'react-router-dom';
import MessagesChat from '../components/MessagesChat';

const MessagesPage = () => {
  const { user } = useContext(AuthContext);
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-7xl mx-auto px-0 sm:px-6 lg:px-8 py-0 sm:py-6">
        <div className="hidden sm:block mb-4">
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-slate-900">Messages</h1>
          <p className="text-slate-500 text-sm mt-1">Chat with shops and our support team — share photos, documents and products.</p>
        </div>
        <MessagesChat heightClass="h-[calc(100vh-7.5rem)] min-h-[520px]" />
      </div>
    </div>
  );
};

export default MessagesPage;
