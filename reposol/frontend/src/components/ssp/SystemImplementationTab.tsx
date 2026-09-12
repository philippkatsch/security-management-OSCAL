import React, { useState, useEffect } from 'react';
import EntityTable from '../shared/entity/EntityTable';
import StatusBadge from '../shared/status/StatusBadge';
import {
  SystemComponent,
  SystemUser,
  InventoryItem,
  LeveragedAuthorization
} from '../../lib/types/oscal';
import {
  addSystemComponent,
  updateSystemComponent,
  removeSystemComponent,
  addSystemUser,
  updateSystemUser,
  removeSystemUser,
  addInventoryItem,
  updateInventoryItem,
  removeInventoryItem,
  addLeveragedAuthorization,
  updateLeveragedAuthorization,
  removeLeveragedAuthorization,
  initializeSSPComponents,
  upsertImplementedRequirement,
  addByComponent,
  addStatementByComponent
} from '../../lib/document-actions';
import ComponentDrawer from './drawers/ComponentDrawer';
import CdefImportModal from './drawers/CdefImportModal';
import UserDrawer from './drawers/UserDrawer';
import InventoryDrawer from './drawers/InventoryDrawer';
import LeveragedAuthDrawer from './drawers/LeveragedAuthDrawer';

export interface SystemImplementationTabProps {
  sysImp: any;
  isEditing: boolean;
  handleUpdateField?: (path: string[], value: any) => void;
  dispatch?: (action: any) => void;
  openDetail?: (type: string, item: any) => void;
  ssp?: any;
}

export function SystemImplementationTab({
  sysImp = {},
  isEditing = false,
  handleUpdateField,
  dispatch,
  openDetail: _openDetail,
  ssp
}: SystemImplementationTabProps) {
  const [impTab, setImpTab] = useState<'users' | 'components' | 'inventory-items' | 'leveraged-authorizations'>('components');

  // Active drawer states
  const [editingComponent, setEditingComponent] = useState<SystemComponent | null>(null);
  const [isCdefModalOpen, setIsCdefModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [editingInventoryItem, setEditingInventoryItem] = useState<InventoryItem | null>(null);
  const [editingAuth, setEditingAuth] = useState<LeveragedAuthorization | null>(null);

  const users: SystemUser[] = sysImp.users || [];
  const components: SystemComponent[] = sysImp.components || [];
  const inventoryItems: InventoryItem[] = sysImp['inventory-items'] || [];
  const auths: LeveragedAuthorization[] = sysImp['leveraged-authorizations'] || [];

  const metadataParties = ssp?.metadata?.parties || [];
  const metadataRoles = ssp?.metadata?.roles || [];

  // Auto-provision this-system root component if none exists
  useEffect(() => {
    if (components.length === 0 || !components.some(c => c.type === 'this-system')) {
      const sysName = ssp?.['system-characteristics']?.['system-name'] || ssp?.metadata?.title || 'This System';
      if (dispatch) {
        dispatch(initializeSSPComponents(sysName));
      } else if (handleUpdateField) {
        const rootComp: SystemComponent = {
          uuid: crypto.randomUUID(),
          type: 'this-system',
          title: sysName,
          description: 'The system as a whole representing organizational, administrative, and system-wide controls.',
          status: { state: 'operational' }
        };
        handleUpdateField(['system-implementation', 'components'], [rootComp, ...components]);
      }
    }
  }, [components.length, dispatch, handleUpdateField, ssp]);

  // Dispatch helper
  const execAction = (action: any, fallbackPath?: string[], fallbackValue?: any) => {
    if (dispatch) {
      dispatch(action);
    } else if (handleUpdateField && fallbackPath && fallbackValue !== undefined) {
      handleUpdateField(fallbackPath, fallbackValue);
    }
  };

  // Component Handlers
  const handleSaveComponent = (comp: SystemComponent) => {
    const exists = components.some(c => c.uuid === comp.uuid);
    if (exists) {
      execAction(
        updateSystemComponent(comp.uuid, comp),
        ['system-implementation', 'components'],
        components.map(c => (c.uuid === comp.uuid ? comp : c))
      );
    } else {
      execAction(
        addSystemComponent(comp),
        ['system-implementation', 'components'],
        [...components, comp]
      );
    }
  };

  const handleDeleteComponent = (uuid: string) => {
    execAction(
      removeSystemComponent(uuid),
      ['system-implementation', 'components'],
      components.filter(c => c.uuid !== uuid)
    );
  };

  const handleAddNewComponent = () => {
    const newComp: SystemComponent = {
      uuid: crypto.randomUUID(),
      type: 'software',
      title: 'New Component',
      description: 'Component description',
      status: { state: 'operational' },
      props: []
    };
    setEditingComponent(newComp);
  };

  const handleImportCdefComponents = (importedComps: SystemComponent[], rawEntities?: any[]) => {
    let currentComps = [...components];
    for (let i = 0; i < importedComps.length; i++) {
      const comp = importedComps[i];
      currentComps = [...currentComps, comp];
      execAction(
        addSystemComponent(comp),
        ['system-implementation', 'components'],
        currentComps
      );

      const raw = rawEntities?.[i];
      if (raw && raw['control-implementations']) {
        for (const ci of raw['control-implementations']) {
          for (const req of ci['implemented-requirements'] || []) {
            if (req['control-id']) {
              if (dispatch) {
                dispatch(upsertImplementedRequirement({
                  'control-id': req['control-id']
                }));
                const rawParams = req['set-parameters'] || ci['set-parameters'] || [];
                const resolvedParams = rawParams.filter(
                  (p: any) => p && p['param-id'] && Array.isArray(p.values) && p.values.length > 0
                );
                const validProps = Array.isArray(req.props)
                  ? req.props.filter((p: any) => p && p.name && p.value)
                  : [];
                const compLabel = comp.title || 'Component';
                dispatch(addByComponent(req['control-id'], {
                  'component-uuid': comp.uuid,
                  description: (req.description && String(req.description).trim()) || `Implemented by ${compLabel}`,
                  ...(resolvedParams.length > 0 ? { 'set-parameters': resolvedParams } : {}),
                  ...(validProps.length > 0 ? { props: validProps } : {})
                }));

                if (req.statements && Array.isArray(req.statements)) {
                  for (const smt of req.statements) {
                    if (smt['statement-id']) {
                      const validSmtProps = Array.isArray(smt.props)
                        ? smt.props.filter((p: any) => p && p.name && p.value)
                        : [];
                      dispatch(addStatementByComponent(req['control-id'], smt['statement-id'], {
                        'component-uuid': comp.uuid,
                        description: (smt.description && String(smt.description).trim()) || (req.description && String(req.description).trim()) || `Implemented by ${compLabel}`,
                        ...(validSmtProps.length > 0 ? { props: validSmtProps } : {})
                      }));
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  };

  // User Handlers
  const handleSaveUser = (user: SystemUser) => {
    const exists = users.some(u => u.uuid === user.uuid);
    if (exists) {
      execAction(
        updateSystemUser(user.uuid, user),
        ['system-implementation', 'users'],
        users.map(u => (u.uuid === user.uuid ? user : u))
      );
    } else {
      execAction(
        addSystemUser(user),
        ['system-implementation', 'users'],
        [...users, user]
      );
    }
  };

  const handleDeleteUser = (uuid: string) => {
    execAction(
      removeSystemUser(uuid),
      ['system-implementation', 'users'],
      users.filter(u => u.uuid !== uuid)
    );
  };

  const handleAddNewUser = () => {
    const newUser: SystemUser = {
      uuid: crypto.randomUUID(),
      title: 'New User Class',
      'short-name': 'NewUser',
      description: '',
      props: [
        { name: 'type', value: 'internal', ns: 'https://fedramp.gov/ns/oscal' },
        { name: 'privilege-level', value: 'non-privileged', ns: 'https://fedramp.gov/ns/oscal' }
      ],
      'authorized-privileges': [
        {
          title: 'General Access',
          'functions-performed': ['Standard application usage']
        }
      ]
    };
    setEditingUser(newUser);
  };

  // Inventory Handlers
  const handleSaveInventoryItem = (item: InventoryItem) => {
    const exists = inventoryItems.some(i => i.uuid === item.uuid);
    if (exists) {
      execAction(
        updateInventoryItem(item.uuid, item),
        ['system-implementation', 'inventory-items'],
        inventoryItems.map(i => (i.uuid === item.uuid ? item : i))
      );
    } else {
      execAction(
        addInventoryItem(item),
        ['system-implementation', 'inventory-items'],
        [...inventoryItems, item]
      );
    }
  };

  const handleDeleteInventoryItem = (uuid: string) => {
    execAction(
      removeInventoryItem(uuid),
      ['system-implementation', 'inventory-items'],
      inventoryItems.filter(i => i.uuid !== uuid)
    );
  };

  const handleAddNewInventoryItem = () => {
    const newItem: InventoryItem = {
      uuid: crypto.randomUUID(),
      description: 'New Asset Instance',
      props: [{ name: 'asset-type', value: 'virtual-machine', ns: 'https://fedramp.gov/ns/oscal' }],
      'implemented-components': components.length > 0 ? [{ 'component-uuid': components[0].uuid }] : []
    };
    setEditingInventoryItem(newItem);
  };

  // Leveraged Auth Handlers
  const handleSaveAuth = (auth: LeveragedAuthorization) => {
    const exists = auths.some(a => a.uuid === auth.uuid);
    if (exists) {
      execAction(
        updateLeveragedAuthorization(auth.uuid, auth),
        ['system-implementation', 'leveraged-authorizations'],
        auths.map(a => (a.uuid === auth.uuid ? auth : a))
      );
    } else {
      execAction(
        addLeveragedAuthorization(auth),
        ['system-implementation', 'leveraged-authorizations'],
        [...auths, auth]
      );
    }
  };

  const handleDeleteAuth = (uuid: string) => {
    execAction(
      removeLeveragedAuthorization(uuid),
      ['system-implementation', 'leveraged-authorizations'],
      auths.filter(a => a.uuid !== uuid)
    );
  };

  const handleAddNewAuth = () => {
    const newAuth: LeveragedAuthorization = {
      uuid: crypto.randomUUID(),
      title: 'New Leveraged Authorization',
      'party-uuid': metadataParties.length > 0 ? metadataParties[0].uuid : '',
      'date-authorized': new Date().toISOString().split('T')[0],
      props: []
    };
    setEditingAuth(newAuth);
  };

  return (
    <div className="sys-imp-tab h-full flex flex-col">
      {/* Sub-Tabs Bar */}
      <div className="p-4 border-b flex justify-between items-center bg-gray-50 dark:bg-gray-800">
        <div className="flex gap-2">
          {[
            { id: 'components', label: 'Components', count: components.length, icon: '🧱' },
            { id: 'users', label: 'Users & Privileges', count: users.length, icon: '👥' },
            { id: 'inventory-items', label: 'Inventory Items', count: inventoryItems.length, icon: '🖥️' },
            { id: 'leveraged-authorizations', label: 'Leveraged Authorizations', count: auths.length, icon: '🛡️' }
          ].map(t => (
            <button
              key={t.id}
              className={`px-3.5 py-2 font-medium text-xs rounded-md flex items-center gap-1.5 transition-colors ${
                impTab === t.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
              onClick={() => setImpTab(t.id as any)}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                impTab === t.id ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {impTab === 'components' && isEditing && (
          <button
            type="button"
            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-3 py-1.5 rounded flex items-center gap-1 shadow-sm"
            onClick={() => setIsCdefModalOpen(true)}
          >
            <span>📦</span>
            <span>Import from CDEF</span>
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="p-6 flex-1 overflow-y-auto">
        {/* Components Table */}
        {impTab === 'components' && (
          <EntityTable
            data={components}
            columns={[
              {
                key: 'title',
                label: 'Title',
                sortable: true,
                render: (v, item) => (
                  <div className="flex items-center gap-1.5 font-medium">
                    {item.type === 'this-system' && <span title="Root System Component">👑</span>}
                    <span>{v}</span>
                  </div>
                )
              },
              {
                key: 'type',
                label: 'Type',
                render: (v) => (
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                    v === 'this-system'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {v}
                  </span>
                )
              },
              {
                key: 'status',
                label: 'Status',
                render: (v) => <StatusBadge status={v?.state || 'unknown'} category="operational-status" />
              },
              {
                key: 'purpose',
                label: 'Purpose / Description',
                render: (v, item) => {
                  const text = v || item.description || '';
                  return text.length > 60 ? text.substring(0, 60) + '...' : text;
                }
              },
              {
                key: 'protocols',
                label: 'Protocols',
                render: (v) => (v || []).length > 0 ? (
                  <span className="text-xs font-mono bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded">
                    {(v || []).map((p: any) => p.name).join(', ')}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">None</span>
                )
              }
            ]}
            onRowClick={(item) => setEditingComponent(item)}
            onAdd={isEditing ? handleAddNewComponent : undefined}
            onDelete={
              isEditing
                ? (uuids) => {
                    const toDelete = uuids.filter((u: string) => {
                      const comp = components.find(c => c.uuid === u);
                      return comp?.type !== 'this-system';
                    });
                    if (toDelete.length !== uuids.length) {
                      alert('Root component (this-system) cannot be deleted.');
                    }
                    for (const u of toDelete) {
                      handleDeleteComponent(u);
                    }
                  }
                : undefined
            }
            addLabel="+ Add Component"
          />
        )}

        {/* Users Table */}
        {impTab === 'users' && (
          <EntityTable
            data={users}
            columns={[
              { key: 'title', label: 'User Class Title', sortable: true },
              { key: 'short-name', label: 'Moniker', render: v => v ? <span className="font-mono text-xs">{v}</span> : '-' },
              {
                key: 'user-type',
                label: 'Access Type',
                render: (_v, item) => {
                  const typeProp = (item.props || []).find((p: any) => p.name === 'type');
                  return typeProp?.value ? (
                    <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                      {typeProp.value}
                    </span>
                  ) : '-';
                }
              },
              {
                key: 'privilege-level',
                label: 'Privilege Level',
                render: (_v, item) => {
                  const privProp = (item.props || []).find((p: any) => p.name === 'privilege-level');
                  const val = privProp?.value || 'unknown';
                  return (
                    <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                      val === 'privileged'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                        : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                    }`}>
                      {val}
                    </span>
                  );
                }
              },
              {
                key: 'role-ids',
                label: 'Roles',
                render: (v) => (
                  <div className="flex flex-wrap gap-1">
                    {(v || []).map((r: string) => (
                      <span key={r} className="bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-[11px]">
                        {r}
                      </span>
                    ))}
                    {(!v || v.length === 0) && <span className="text-xs text-gray-400">None</span>}
                  </div>
                )
              },
              {
                key: 'authorized-privileges',
                label: 'Privileges',
                render: (v) => (v || []).length
              }
            ]}
            onRowClick={(item) => setEditingUser(item)}
            onAdd={isEditing ? handleAddNewUser : undefined}
            onDelete={
              isEditing
                ? (uuids) => {
                    for (const u of uuids) handleDeleteUser(u);
                  }
                : undefined
            }
            addLabel="+ Add User Class"
          />
        )}

        {/* Inventory Items Table */}
        {impTab === 'inventory-items' && (
          <EntityTable
            data={inventoryItems}
            columns={[
              { key: 'description', label: 'Asset Description', sortable: true },
              {
                key: 'asset-id-tag',
                label: 'Asset ID / Tag',
                render: (_v, item) => {
                  const tag = (item.props || []).find((p: any) => p.name === 'asset-tag')?.value;
                  const id = (item.props || []).find((p: any) => p.name === 'asset-id')?.value;
                  return <span className="font-mono text-xs">{tag || id || '-'}</span>;
                }
              },
              {
                key: 'network-address',
                label: 'IP / FQDN',
                render: (_v, item) => {
                  const ip = (item.props || []).find((p: any) => p.name === 'ipv4-address')?.value;
                  const fqdn = (item.props || []).find((p: any) => p.name === 'fqdn')?.value;
                  return <span className="text-xs font-mono text-gray-600 dark:text-gray-300">{ip || fqdn || '-'}</span>;
                }
              },
              {
                key: 'implemented-components',
                label: 'Implemented Comps',
                render: (v) => {
                  const count = (v || []).length;
                  return count > 0 ? (
                    <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200 px-2 py-0.5 rounded font-semibold">
                      {count} component{count !== 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">0</span>
                  );
                }
              },
              {
                key: 'is-scanned',
                label: 'Scanned',
                render: (_v, item) => {
                  const isScanned = (item.props || []).find((p: any) => p.name === 'is-scanned')?.value === 'yes';
                  return isScanned ? (
                    <span className="text-xs text-green-600 dark:text-green-400 font-bold">✓ Yes</span>
                  ) : (
                    <span className="text-xs text-gray-400">No</span>
                  );
                }
              }
            ]}
            onRowClick={(item) => setEditingInventoryItem(item)}
            onAdd={isEditing ? handleAddNewInventoryItem : undefined}
            onDelete={
              isEditing
                ? (uuids) => {
                    for (const u of uuids) handleDeleteInventoryItem(u);
                  }
                : undefined
            }
            addLabel="+ Add Inventory Item"
          />
        )}

        {/* Leveraged Authorizations Table */}
        {impTab === 'leveraged-authorizations' && (
          <EntityTable
            data={auths}
            columns={[
              { key: 'title', label: 'Authorization Title', sortable: true },
              {
                key: 'party-uuid',
                label: 'Provider Party',
                render: (v) => {
                  const p = metadataParties.find((party: any) => party.uuid === v);
                  return p ? (
                    <span className="font-semibold text-xs text-blue-600 dark:text-blue-400">
                      {p.name || p['short-name'] || v}
                    </span>
                  ) : (
                    <span className="font-mono text-xs text-gray-500">{v ? v.substring(0, 8) + '...' : '-'}</span>
                  );
                }
              },
              { key: 'date-authorized', label: 'Date Authorized' },
              {
                key: 'links',
                label: 'Links',
                render: (v) => (v || []).length
              }
            ]}
            onRowClick={(item) => setEditingAuth(item)}
            onAdd={isEditing ? handleAddNewAuth : undefined}
            onDelete={
              isEditing
                ? (uuids) => {
                    for (const u of uuids) handleDeleteAuth(u);
                  }
                : undefined
            }
            addLabel="+ Add Leveraged Auth"
          />
        )}
      </div>

      {/* Specialized Entity Drawers & Modals */}
      <ComponentDrawer
        isOpen={!!editingComponent}
        onClose={() => setEditingComponent(null)}
        component={editingComponent}
        onSave={handleSaveComponent}
        onDelete={handleDeleteComponent}
        isEditing={isEditing}
        metadataRoles={metadataRoles}
        leveragedAuths={auths}
      />

      <CdefImportModal
        isOpen={isCdefModalOpen}
        onClose={() => setIsCdefModalOpen(false)}
        onImport={handleImportCdefComponents}
      />

      <UserDrawer
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        user={editingUser}
        onSave={handleSaveUser}
        onDelete={handleDeleteUser}
        isEditing={isEditing}
        metadataRoles={metadataRoles}
      />

      <InventoryDrawer
        isOpen={!!editingInventoryItem}
        onClose={() => setEditingInventoryItem(null)}
        item={editingInventoryItem}
        onSave={handleSaveInventoryItem}
        onDelete={handleDeleteInventoryItem}
        isEditing={isEditing}
        components={components}
        metadataParties={metadataParties}
      />

      <LeveragedAuthDrawer
        isOpen={!!editingAuth}
        onClose={() => setEditingAuth(null)}
        auth={editingAuth}
        onSave={handleSaveAuth}
        onDelete={handleDeleteAuth}
        isEditing={isEditing}
        metadataParties={metadataParties}
      />
    </div>
  );
}

export default SystemImplementationTab;
