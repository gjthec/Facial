import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

const Register: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#f0f2f5]">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md text-center">
        <ShieldAlert className="w-12 h-12 text-orange-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">Acesso Restrito</h2>
        <p className="text-gray-600 mb-6">
          O registro de novos usuários é gerenciado pela administração da universidade via Google Workspace.
        </p>
        <Link to="/login" className="text-blue-600 font-medium hover:underline">
          Voltar para Login
        </Link>
      </div>
    </div>
  );
};

export default Register;