import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Usuario } from '../types/database.types';

interface AuthContextType {
  user: User | null;
  userProfile: Usuario | null;
  userContratoIds: string[]; // All contract IDs linked to this user
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isAdminAgir: boolean; // Deprecated: use isAdminAgirCorporativo or isAdminAgirPlanta
  isAdminAgirCorporativo: boolean;
  isAdminAgirPlanta: boolean;
  isAdminTerceiro: boolean;
  isTerceiro: boolean;
  unidadeHospitalarId: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<Usuario | null>(null);
  const [userContratoIds, setUserContratoIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar sessão existente
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Escutar mudanças na autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (userId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setUserProfile(data);

      // Load all contract IDs for this user from usuario_contrato table
      const { data: userContratos } = await supabase
        .from('usuario_contrato')
        .select('contrato_id')
        .eq('usuario_id', userId);

      const contratoIds = userContratos?.map(uc => uc.contrato_id) || [];

      // Also include the main contrato_id if it exists (for backward compatibility)
      if (data?.contrato_id && !contratoIds.includes(data.contrato_id)) {
        contratoIds.push(data.contrato_id);
      }

      setUserContratoIds(contratoIds);
    } catch (error) {
      console.error('Erro ao carregar perfil do usuário:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUserProfile(null);
    setUserContratoIds([]);
  };

  const isAdminAgirCorporativo = userProfile?.tipo === 'administrador-agir-corporativo';
  const isAdminAgirPlanta = userProfile?.tipo === 'administrador-agir-planta';
  const isAdminTerceiro = userProfile?.tipo === 'administrador-terceiro';
  const isTerceiro = userProfile?.tipo === 'terceiro';
  const isAdminAgir = isAdminAgirCorporativo || isAdminAgirPlanta; // Backward compatibility
  const isAdmin = isAdminAgir || isAdminTerceiro;
  const unidadeHospitalarId = userProfile?.unidade_hospitalar_id || null;

  const value = {
    user,
    userProfile,
    userContratoIds,
    loading,
    signIn,
    signOut,
    isAdmin,
    isAdminAgir,
    isAdminAgirCorporativo,
    isAdminAgirPlanta,
    isAdminTerceiro,
    isTerceiro,
    unidadeHospitalarId,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
