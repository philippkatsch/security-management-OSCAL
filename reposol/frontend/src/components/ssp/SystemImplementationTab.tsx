import React, { useState } from 'react';
import EntityTable from '../shared/entity/EntityTable';
import StatusBadge from '../shared/status/StatusBadge';

export function SystemImplementationTab({ sysImp, isEditing, handleUpdateField, openDetail }) {
  const [impTab, setImpTab] = useState('users');
  
  const generateUUID = () => crypto.randomUUID();
  const users = sysImp.users || [];
  const components = sysImp.components || [];
  const inventoryItems = sysImp['inventory-items'] || [];
  const auths = sysImp['leveraged-authorizations'] || [];

  return (
    <div className="sys-imp-tab h-full flex flex-col">
      <div className="p-4 border-b flex gap-4 bg-gray-50 dark:bg-gray-800">
        {['users', 'components', 'inventory-items', 'leveraged-authorizations'].map(t => (
          <button key={t} className={`px-4 py-2 font-medium rounded ${impTab === t ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`} onClick={() => setImpTab(t)}>
            {t.split('-').map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ')}
          </button>
        ))}
      </div>
      <div className="p-6 flex-1">
        {impTab === 'users' && (
          <EntityTable data={users} columns={[
            { key: 'title', label: 'Title', sortable: true },
            { key: 'role-ids', label: 'Roles', render: v => (v||[]).map(r=><span key={r} className="mr-1 bg-gray-200 dark:bg-gray-700 px-2 rounded text-xs">{r}</span>) },
            { key: 'props', label: 'Props', render: v => (v||[]).length }
          ]}
          onRowClick={item => openDetail('user', item)}
          onAdd={isEditing ? () => {
            handleUpdateField(['system-implementation', 'users'], [...users, { uuid: generateUUID(), title: 'New User' }]);
          } : undefined}
          onDelete={isEditing ? uuids => handleUpdateField(['system-implementation', 'users'], users.filter(x => !uuids.includes(x.uuid))) : undefined}
          addLabel="+ Add User" />
        )}
        {impTab === 'components' && (
          <EntityTable data={components} columns={[
            { key: 'title', label: 'Title', sortable: true },
            { key: 'type', label: 'Type' },
            { key: 'status', label: 'Status', render: v => <StatusBadge status={v?.state||'unknown'} category="operational-status" /> },
            { key: 'description', label: 'Description', render: v => v && v.length > 50 ? v.substring(0, 50)+'...' : v }
          ]}
          onRowClick={item => openDetail('component', item)}
          onAdd={isEditing ? () => {
            handleUpdateField(['system-implementation', 'components'], [...components, { uuid: generateUUID(), title: 'New Component', type: 'software' }]);
          } : undefined}
          onDelete={isEditing ? uuids => handleUpdateField(['system-implementation', 'components'], components.filter(x => !uuids.includes(x.uuid))) : undefined}
          addLabel="+ Add Component" />
        )}
        {impTab === 'inventory-items' && (
          <EntityTable data={inventoryItems} columns={[
            { key: 'description', label: 'Description', sortable: true },
            { key: 'implemented-components', label: 'Implemented Comps', render: v => (v||[]).length }
          ]}
          onRowClick={item => openDetail('inventory', item)}
          onAdd={isEditing ? () => {
            handleUpdateField(['system-implementation', 'inventory-items'], [...inventoryItems, { uuid: generateUUID(), description: 'New Inventory Item' }]);
          } : undefined}
          onDelete={isEditing ? uuids => handleUpdateField(['system-implementation', 'inventory-items'], inventoryItems.filter(x => !uuids.includes(x.uuid))) : undefined}
          addLabel="+ Add Inventory Item" />
        )}
        {impTab === 'leveraged-authorizations' && (
          <EntityTable data={auths} columns={[
            { key: 'title', label: 'Title', sortable: true },
            { key: 'party-uuid', label: 'Party' },
            { key: 'date-authorized', label: 'Date Authorized' }
          ]}
          onRowClick={item => openDetail('auth', item)}
          onAdd={isEditing ? () => {
            handleUpdateField(['system-implementation', 'leveraged-authorizations'], [...auths, { uuid: generateUUID(), title: 'New Auth' }]);
          } : undefined}
          onDelete={isEditing ? uuids => handleUpdateField(['system-implementation', 'leveraged-authorizations'], auths.filter(x => !uuids.includes(x.uuid))) : undefined}
          addLabel="+ Add Auth" />
        )}
      </div>
    </div>
  );
}
