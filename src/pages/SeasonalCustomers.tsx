import React from 'react';
import SweetsTabs from '../components/SweetsTabs';
import PeopleScreen from '../components/people/PeopleScreen';
import { Navigate, useNavIntent } from '../hooks/useNavIntent';

// The same customer list, opened on its Sweets filter from the sweets tabs.
const SeasonalCustomers: React.FC<{ onNavigate?: Navigate }> = ({ onNavigate = () => {} }) => {
  const intent = useNavIntent('seasonal_customers');
  return (
    <PeopleScreen title="Sweets customers" onNavigate={onNavigate} intent={intent} startFilter="sweets" defaultBuys={['sweets']}
      tabs={<SweetsTabs current="seasonal_customers" onNavigate={onNavigate} />} />
  );
};

export default SeasonalCustomers;
