import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { DataCenter, TeamMember, EventType } from '../types';

// ─── Data Center (GST / FSSAI) ───────────────────────────────────────────────

export const useDataCenter = () =>
  useQuery({
    queryKey: ['data_center'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('data_center').select('*').limit(1).maybeSingle();
      if (error) throw error;
      return data as DataCenter | null;
    },
  });

export const useUpsertDataCenter = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Partial<DataCenter>) => {
      const { data: existing } = await supabase
        .from('data_center').select('id').limit(1).maybeSingle();
      if (existing) {
        const { data, error } = await supabase
          .from('data_center')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', existing.id).select().single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('data_center').insert(updates).select().single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['data_center'] }),
  });
};

// ─── Team Members ─────────────────────────────────────────────────────────────

export const useTeamMembers = () =>
  useQuery({
    queryKey: ['team_members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      return data as TeamMember[];
    },
  });

export const useCreateTeamMember = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (member: Omit<TeamMember, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('team_members').insert(member).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team_members'] }),
  });
};

export const useUpdateTeamMember = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TeamMember> & { id: string }) => {
      const { data, error } = await supabase
        .from('team_members').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team_members'] }),
  });
};

export const useDeleteTeamMember = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('team_members').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team_members'] }),
  });
};

// ─── Event Types ──────────────────────────────────────────────────────────────

const DEFAULT_EVENTS = ['Wedding', 'Birthday', 'Corporate', 'Anniversary', 'Reception', 'Engagement', 'Other'];

export const useEventTypes = () =>
  useQuery({
    queryKey: ['event_types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_types').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      return data as EventType[];
    },
  });

export const useCreateEventType = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('event_types').insert({ name }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event_types'] }),
  });
};

export const useUpdateEventType = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { data, error } = await supabase
        .from('event_types').update({ name }).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event_types'] }),
  });
};

export const useDeleteEventType = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('event_types').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event_types'] }),
  });
};

export { DEFAULT_EVENTS };
