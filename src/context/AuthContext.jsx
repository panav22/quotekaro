import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);         // supabase auth user
  const [profile, setProfile] = useState(null);   // users table row
  const [tenant, setTenant] = useState(null);     // tenants table row
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch user profile + tenant on auth change
  const fetchProfileAndTenant = async (authUser) => {
    if (!authUser) {
      setProfile(null);
      setTenant(null);
      setLoading(false);
      return;
    }
    try {
      // Get user profile
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Get tenant if not superadmin
      if (profileData.role !== 'superadmin' && profileData.tenant_id) {
        const { data: tenantData, error: tenantError } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', profileData.tenant_id)
          .single();
        if (tenantError) throw tenantError;
        setTenant(tenantData);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      fetchProfileAndTenant(session?.user ?? null);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      fetchProfileAndTenant(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email, password) => {
    setError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setProfile(null);
    setTenant(null);
  };

  // Log every significant action to activity_log
  const logActivity = async (action, entityType = null, entityId = null, metadata = {}) => {
    if (!profile) return;
    try {
      await supabase.from('activity_log').insert({
        tenant_id: profile.tenant_id || null,
        user_id: profile.id,
        action,
        entity_type: entityType,
        entity_id: entityId,
        metadata,
      });
    } catch (err) {
      console.error('Activity log error:', err);
    }
  };

  const isSuperAdmin = profile?.role === 'superadmin';
  const isOwner = profile?.role === 'owner';
  const isStaff = profile?.role === 'staff';

  const value = {
    user,
    profile,
    tenant,
    loading,
    error,
    signIn,
    signOut,
    logActivity,
    isSuperAdmin,
    isOwner,
    isStaff,
    refetchProfile: () => fetchProfileAndTenant(user),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
