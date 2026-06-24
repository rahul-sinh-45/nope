import React from 'react';
import { Plus, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import LockedButtonWrapper from '../../../components/LockedButtonWrapper';

export default function ActionButtons() {
  const navigate = useNavigate();
  
  return (
    <div className="action-grid-top animate-up" style={{ animationDelay: '0.1s' }}>
      <LockedButtonWrapper featureId="withdraw_funds">
        <button 
          onClick={() => navigate('/funds/withdraw')}
          className="top-btn btn-withdraw w-full"
        >
          <Download size={18} className="rotate-180" /> Withdraw
        </button>
      </LockedButtonWrapper>

      <LockedButtonWrapper featureId="add_funds">
        <button 
          onClick={() => navigate('/funds/add')}
          className="top-btn btn-add w-full"
        >
          <Plus size={18} /> Add Funds
        </button>
      </LockedButtonWrapper>
    </div>
  );
}
