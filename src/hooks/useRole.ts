import { createContext, useContext } from 'react';
import type { Role } from '../components/navItems';

// The signed-in person's role, set once in App.
export const RoleContext = createContext<Role>('owner');
export const useRole = () => useContext(RoleContext);
