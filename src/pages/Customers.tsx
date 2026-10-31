import React from 'react';
import { Navigate, useNavIntent } from '../hooks/useNavIntent';
import PeopleScreen from '../components/people/PeopleScreen';

// Catering and sweets customers in one list.
const Customers: React.FC<{ onNavigate: Navigate }> = ({ onNavigate }) => {
  const intent = useNavIntent('customers');
  return <PeopleScreen title="Customers" onNavigate={onNavigate} intent={intent} />;
};

export default Customers;
