import React, { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Save } from 'lucide-react';
import { api, getErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import AuthImage from '../components/common/AuthImage.jsx';

export default function ConfigurationPage() {
  const { hasPerm, refreshSession } = useAuth();
  const canEdit = hasPerm('configuration', 'edit');

  const [tab, setTab] = useState('company');
  const [company, setCompany] = useState({
    companyName: '',
    companyAddress: '',
    companyPhone: '',
    companyEmail: '',
    logoAttachmentId: null,
  });
  const [configs, setConfigs] = useState({});
  const [roles, setRoles] = useState([]);
  const [newRoleName, setNewRoleName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadAll = useCallback(async () => {
    try {
      const [compRes, cfgRes, rolesRes] = await Promise.all([
        api.get('/config/company'),
        api.get('/config/inspections'),
        api.get('/config/roles'),
      ]);
      if (compRes.data?.data) setCompany(compRes.data.data);
      setConfigs(cfgRes.data?.data || {});
      setRoles(rolesRes.data?.data || []);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const saveCompany = async () => {
    setError('');
    setNotice('');
    setSaving(true);
    try {
      await api.patch('/config/company', company);
      await refreshSession();
      setNotice('Company branding settings saved.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/attachments/upload-logo', fd);
      const logoId = res.data?.data?._id;
      if (logoId) {
        const next = { ...company, logoAttachmentId: logoId };
        setCompany(next);
        await api.patch('/config/company', next);
        await refreshSession();
        setNotice('Company logo uploaded and saved.');
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const saveModuleConfig = async (moduleName) => {
    setError('');
    setNotice('');
    setSaving(true);
    try {
      await api.put(`/config/inspections/${moduleName}`, configs[moduleName]);
      setNotice(`Saved configuration for '${moduleName}'.`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const saveRole = async (roleObj) => {
    setError('');
    setNotice('');
    setSaving(true);
    try {
      await api.put(`/config/roles/${encodeURIComponent(roleObj.roleName)}`, {
        description: roleObj.description,
        permissions: roleObj.permissions,
      });
      await refreshSession();
      setNotice(`Updated role permissions for '${roleObj.roleName}'.`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const createCustomRole = async () => {
    if (!newRoleName.trim()) return;
    setError('');
    try {
      await api.post('/config/roles', {
        roleName: newRoleName.trim(),
        description: 'Custom QMS Role',
      });
      setNewRoleName('');
      await loadAll();
      setNotice('Custom role created.');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const tc = configs.target_chart || { indicators: [] };
  const ss = configs.size_set || {
    allowNAForRoles: [],
    acceptanceRules: {},
    accessoriesChecklist: [],
    workmanshipChecklist: [],
    labellingChecklist: [],
  };
  const sp = configs.seven_point || { checkpoints: [], countingRules: {}, approvalWorkflow: [] };
  const ms = configs.measurement || { approvalWorkflow: [] };

  const moveChecklistItem = (sectionProp, idx, dir) => {
    const arr = [...(ss[sectionProp] || [])];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    const reordered = arr.map((item, i) => ({ ...item, sortOrder: i + 1 }));
    setConfigs((prev) => ({
      ...prev,
      size_set: { ...ss, [sectionProp]: reordered },
    }));
  };

  const renderSizeSetChecklistEditor = (title, sectionProp) => {
    const items = ss[sectionProp] || [];
    return (
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem' }}>{title}</h3>
          {canEdit ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                const next = [
                  ...items,
                  {
                    itemKey: `custom_${Date.now()}`,
                    label: 'New Checklist Item',
                    isActive: true,
                    isCritical: false,
                    sortOrder: items.length + 1,
                  },
                ];
                setConfigs((prev) => ({ ...prev, size_set: { ...ss, [sectionProp]: next } }));
              }}
            >
              <Plus size={13} aria-hidden="true" />
              <span>Add Item</span>
            </button>
          ) : null}
        </div>
        <div className="table-wrapper" tabIndex={0} role="region" aria-label="Configuration data table">
          <table className="qms-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Label</th>
                <th>Critical</th>
                <th>Active</th>
                {canEdit ? <th>Reorder</th> : null}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.itemKey}>
                  <td>{idx + 1}</td>
                  <td>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={item.label}
                      onChange={(e) => {
                        const next = items.map((x, i) =>
                          i === idx ? { ...x, label: e.target.value } : x
                        );
                        setConfigs((prev) => ({ ...prev, size_set: { ...ss, [sectionProp]: next } }));
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={Boolean(item.isCritical)}
                      onChange={(e) => {
                        const next = items.map((x, i) =>
                          i === idx ? { ...x, isCritical: e.target.checked } : x
                        );
                        setConfigs((prev) => ({ ...prev, size_set: { ...ss, [sectionProp]: next } }));
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={item.isActive !== false}
                      onChange={(e) => {
                        const next = items.map((x, i) =>
                          i === idx ? { ...x, isActive: e.target.checked } : x
                        );
                        setConfigs((prev) => ({ ...prev, size_set: { ...ss, [sectionProp]: next } }));
                      }}
                    />
                  </td>
                  {canEdit ? (
                    <td>
                      <div className="btn-row">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={idx === 0}
                          onClick={() => moveChecklistItem(sectionProp, idx, -1)}
                        >
                          <ArrowUp size={13} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={idx === items.length - 1}
                          onClick={() => moveChecklistItem(sectionProp, idx, 1)}
                        >
                          <ArrowDown size={13} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const toggleRolePerm = (roleIdx, section, action) => {
    setRoles((prev) =>
      prev.map((r, i) => {
        if (i !== roleIdx) return r;
        const curr = Boolean(r.permissions?.[section]?.[action]);
        return {
          ...r,
          permissions: {
            ...r.permissions,
            [section]: {
              ...r.permissions?.[section],
              [action]: !curr,
            },
          },
        };
      })
    );
  };

  return (
    <div>
      <section className="card">
        <div className="card-header">
          <div>
            <h1 className="card-title" style={{ fontSize: '1.15rem' }}>
              QMS System Configuration &amp; Workflows
            </h1>
            <span className="muted">
              Configure checklists, checkpoints, acceptance rules, role permissions &amp; branding without code edits
            </span>
          </div>
        </div>

        <div className="tablist" role="tablist">
          {[
            ['company', 'Company & PDF Branding'],
            ['target_chart', '1. Target Chart Indicators'],
            ['size_set', '2. Size Set Checklists & Rules'],
            ['seven_point', '3. 7 Point Checkpoints & Flow'],
            ['measurement', '4. Measurement Flow'],
            ['roles', 'Role Permissions'],
          ].map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              className="tab-btn"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
            >
              {label}
            </button>
          ))}
        </div>

        {error ? <div className="alert alert-error">{error}</div> : null}
        {notice ? <div className="alert alert-success">{notice}</div> : null}

        {tab === 'company' ? (
          <div>
            <div className="grid-2">
              <div className="field">
                <label htmlFor="cfg-cname">Company Name (shown on PDF headers)</label>
                <input
                  id="cfg-cname"
                  type="text"
                  disabled={!canEdit}
                  value={company.companyName || ''}
                  onChange={(e) => setCompany({ ...company, companyName: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="cfg-cemail">Contact Email</label>
                <input
                  id="cfg-cemail"
                  type="email"
                  disabled={!canEdit}
                  value={company.companyEmail || ''}
                  onChange={(e) => setCompany({ ...company, companyEmail: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="cfg-cphone">Phone</label>
                <input
                  id="cfg-cphone"
                  type="text"
                  disabled={!canEdit}
                  value={company.companyPhone || ''}
                  onChange={(e) => setCompany({ ...company, companyPhone: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="cfg-caddr">Factory Address</label>
                <input
                  id="cfg-caddr"
                  type="text"
                  disabled={!canEdit}
                  value={company.companyAddress || ''}
                  onChange={(e) => setCompany({ ...company, companyAddress: e.target.value })}
                />
              </div>
            </div>

            <div className="field">
              <label>Company Logo (embedded in PDFs)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {company.logoAttachmentId ? (
                  <AuthImage
                    attachmentId={company.logoAttachmentId}
                    alt="Company logo"
                    style={{ width: 64, height: 64, objectFit: 'contain' }}
                  />
                ) : (
                  <span className="muted">No logo uploaded</span>
                )}
                {canEdit ? (
                  <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                    <span>Upload Logo</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleLogoUpload}
                      style={{ display: 'none' }}
                    />
                  </label>
                ) : null}
              </div>
            </div>

            {canEdit ? (
              <button type="button" className="btn btn-primary" disabled={saving} onClick={saveCompany}>
                <Save size={15} aria-hidden="true" />
                <span>Save Company Settings</span>
              </button>
            ) : null}
          </div>
        ) : null}

        {tab === 'target_chart' ? (
          <div>
            <p className="muted">Configure the 15 indicator parameters shown on the 3×5 Target Chart.</p>
            <div className="table-wrapper" tabIndex={0} role="region" aria-label="Configuration data table" style={{ marginBottom: '1rem' }}>
              <table className="qms-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Code</th>
                    <th>Parameter Name</th>
                    <th>Unit</th>
                    <th>Default Target</th>
                    <th>Active</th>
                  </tr>
                </thead>
                <tbody>
                  {(tc.indicators || []).map((ind, idx) => (
                    <tr key={ind.index || idx}>
                      <td>{ind.index}</td>
                      <td>
                        <input
                          type="text"
                          disabled={!canEdit}
                          value={ind.code || ''}
                          onChange={(e) => {
                            const next = tc.indicators.map((x, i) =>
                              i === idx ? { ...x, code: e.target.value } : x
                            );
                            setConfigs((prev) => ({
                              ...prev,
                              target_chart: { ...tc, indicators: next },
                            }));
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          disabled={!canEdit}
                          value={ind.name || ''}
                          onChange={(e) => {
                            const next = tc.indicators.map((x, i) =>
                              i === idx ? { ...x, name: e.target.value } : x
                            );
                            setConfigs((prev) => ({
                              ...prev,
                              target_chart: { ...tc, indicators: next },
                            }));
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          disabled={!canEdit}
                          value={ind.unit || ''}
                          onChange={(e) => {
                            const next = tc.indicators.map((x, i) =>
                              i === idx ? { ...x, unit: e.target.value } : x
                            );
                            setConfigs((prev) => ({
                              ...prev,
                              target_chart: { ...tc, indicators: next },
                            }));
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          disabled={!canEdit}
                          value={ind.defaultTarget ?? 0}
                          onChange={(e) => {
                            const next = tc.indicators.map((x, i) =>
                              i === idx ? { ...x, defaultTarget: Number(e.target.value) } : x
                            );
                            setConfigs((prev) => ({
                              ...prev,
                              target_chart: { ...tc, indicators: next },
                            }));
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          disabled={!canEdit}
                          checked={ind.isActive !== false}
                          onChange={(e) => {
                            const next = tc.indicators.map((x, i) =>
                              i === idx ? { ...x, isActive: e.target.checked } : x
                            );
                            setConfigs((prev) => ({
                              ...prev,
                              target_chart: { ...tc, indicators: next },
                            }));
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {canEdit ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={saving}
                onClick={() => saveModuleConfig('target_chart')}
              >
                <Save size={15} aria-hidden="true" />
                <span>Save Target Chart Configuration</span>
              </button>
            ) : null}
          </div>
        ) : null}

        {tab === 'size_set' ? (
          <div>
            <div className="grid-4" style={{ marginBottom: '1rem' }}>
              <div className="field">
                <label htmlFor="ss-min-ok">Minimum OK % for Acceptance</label>
                <input
                  id="ss-min-ok"
                  type="number"
                  min={0}
                  max={100}
                  disabled={!canEdit}
                  value={ss.acceptanceRules?.minOkPercentageForAccept ?? 95}
                  onChange={(e) =>
                    setConfigs((prev) => ({
                      ...prev,
                      size_set: {
                        ...ss,
                        acceptanceRules: {
                          ...ss.acceptanceRules,
                          minOkPercentageForAccept: Number(e.target.value),
                        },
                      },
                    }))
                  }
                />
              </div>
              <div className="field">
                <label>Block Accept if Any Not OK</label>
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  checked={Boolean(ss.acceptanceRules?.blockAcceptIfAnyNotOk)}
                  onChange={(e) =>
                    setConfigs((prev) => ({
                      ...prev,
                      size_set: {
                        ...ss,
                        acceptanceRules: {
                          ...ss.acceptanceRules,
                          blockAcceptIfAnyNotOk: e.target.checked,
                        },
                      },
                    }))
                  }
                />
              </div>
              <div className="field">
                <label>Block Accept if Critical Not OK</label>
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  checked={Boolean(ss.acceptanceRules?.blockAcceptIfCriticalNotOk)}
                  onChange={(e) =>
                    setConfigs((prev) => ({
                      ...prev,
                      size_set: {
                        ...ss,
                        acceptanceRules: {
                          ...ss.acceptanceRules,
                          blockAcceptIfCriticalNotOk: e.target.checked,
                        },
                      },
                    }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="ss-na-roles">Roles Allowed to Mark N/A (comma-separated)</label>
                <input
                  id="ss-na-roles"
                  type="text"
                  disabled={!canEdit}
                  value={(ss.allowNAForRoles || []).join(', ')}
                  onChange={(e) =>
                    setConfigs((prev) => ({
                      ...prev,
                      size_set: {
                        ...ss,
                        allowNAForRoles: e.target.value
                          .split(',')
                          .map((r) => r.trim())
                          .filter(Boolean),
                      },
                    }))
                  }
                />
              </div>
            </div>

            {renderSizeSetChecklistEditor('Accessories Checklist', 'accessoriesChecklist')}
            {renderSizeSetChecklistEditor('Workmanship Checklist', 'workmanshipChecklist')}
            {renderSizeSetChecklistEditor('Labelling Checklist', 'labellingChecklist')}

            {canEdit ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={saving}
                onClick={() => saveModuleConfig('size_set')}
              >
                <Save size={15} aria-hidden="true" />
                <span>Save Size Set Configuration</span>
              </button>
            ) : null}
          </div>
        ) : null}

        {tab === 'seven_point' ? (
          <div>
            <div className="grid-3">
              <div className="field">
                <label htmlFor="sp-count">Configured Checkpoint Count (e.g. 7 or 10)</label>
                <input
                  id="sp-count"
                  type="number"
                  min={1}
                  max={20}
                  disabled={!canEdit}
                  value={sp.checkpointCount ?? 10}
                  onChange={(e) => {
                    const count = Math.max(1, Number(e.target.value) || 1);
                    const current = sp.checkpoints || [];
                    const resized = Array.from({ length: count }, (_, idx) => {
                      return (
                        current[idx] || {
                          checkpointNumber: idx + 1,
                          label: `Point ${idx + 1}`,
                          description: '',
                          isActive: true,
                        }
                      );
                    });
                    setConfigs((prev) => ({
                      ...prev,
                      seven_point: { ...sp, checkpointCount: count, checkpoints: resized },
                    }));
                  }}
                />
              </div>
              <div className="field">
                <label>Enforce OK + Rework + Rejected = Total</label>
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  checked={sp.countingRules?.enforceSumEqualsTotal !== false}
                  onChange={(e) =>
                    setConfigs((prev) => ({
                      ...prev,
                      seven_point: {
                        ...sp,
                        countingRules: {
                          ...sp.countingRules,
                          enforceSumEqualsTotal: e.target.checked,
                        },
                      },
                    }))
                  }
                />
              </div>
              <div className="field">
                <label>Enforce Sequential 5-Tier Approval</label>
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  checked={sp.enforceSequentialApproval !== false}
                  onChange={(e) =>
                    setConfigs((prev) => ({
                      ...prev,
                      seven_point: { ...sp, enforceSequentialApproval: e.target.checked },
                    }))
                  }
                />
              </div>
            </div>

            <div className="table-wrapper" tabIndex={0} role="region" aria-label="Configuration data table" style={{ marginBottom: '1rem' }}>
              <table className="qms-table">
                <thead>
                  <tr>
                    <th>Column #</th>
                    <th>Checkpoint Label</th>
                    <th>Description</th>
                    <th>Active</th>
                  </tr>
                </thead>
                <tbody>
                  {(sp.checkpoints || []).map((cp, idx) => (
                    <tr key={cp.checkpointNumber || idx}>
                      <td>{cp.checkpointNumber}</td>
                      <td>
                        <input
                          type="text"
                          disabled={!canEdit}
                          value={cp.label}
                          onChange={(e) => {
                            const next = sp.checkpoints.map((x, i) =>
                              i === idx ? { ...x, label: e.target.value } : x
                            );
                            setConfigs((prev) => ({
                              ...prev,
                              seven_point: { ...sp, checkpoints: next },
                            }));
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          disabled={!canEdit}
                          value={cp.description || ''}
                          onChange={(e) => {
                            const next = sp.checkpoints.map((x, i) =>
                              i === idx ? { ...x, description: e.target.value } : x
                            );
                            setConfigs((prev) => ({
                              ...prev,
                              seven_point: { ...sp, checkpoints: next },
                            }));
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          disabled={!canEdit}
                          checked={cp.isActive !== false}
                          onChange={(e) => {
                            const next = sp.checkpoints.map((x, i) =>
                              i === idx ? { ...x, isActive: e.target.checked } : x
                            );
                            setConfigs((prev) => ({
                              ...prev,
                              seven_point: { ...sp, checkpoints: next },
                            }));
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 style={{ fontSize: '0.95rem' }}>Approval Workflow Stages (QC → Supervisor → QAM → PM → FM)</h3>
            <div className="table-wrapper" tabIndex={0} role="region" aria-label="Configuration data table" style={{ marginBottom: '1rem' }}>
              <table className="qms-table">
                <thead>
                  <tr>
                    <th>Stage</th>
                    <th>Required</th>
                    <th>Allowed Roles (comma-separated)</th>
                  </tr>
                </thead>
                <tbody>
                  {(sp.approvalWorkflow || []).map((st, idx) => (
                    <tr key={st.stage}>
                      <td><strong>{st.stage}</strong></td>
                      <td>
                        <input
                          type="checkbox"
                          disabled={!canEdit}
                          checked={st.required !== false}
                          onChange={(e) => {
                            const next = sp.approvalWorkflow.map((x, i) =>
                              i === idx ? { ...x, required: e.target.checked } : x
                            );
                            setConfigs((prev) => ({
                              ...prev,
                              seven_point: { ...sp, approvalWorkflow: next },
                            }));
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          disabled={!canEdit}
                          value={(st.allowedRoles || []).join(', ')}
                          onChange={(e) => {
                            const next = sp.approvalWorkflow.map((x, i) =>
                              i === idx
                                ? {
                                    ...x,
                                    allowedRoles: e.target.value
                                      .split(',')
                                      .map((r) => r.trim())
                                      .filter(Boolean),
                                  }
                                : x
                            );
                            setConfigs((prev) => ({
                              ...prev,
                              seven_point: { ...sp, approvalWorkflow: next },
                            }));
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {canEdit ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={saving}
                onClick={() => saveModuleConfig('seven_point')}
              >
                <Save size={15} aria-hidden="true" />
                <span>Save 7 Point Configuration</span>
              </button>
            ) : null}
          </div>
        ) : null}

        {tab === 'measurement' ? (
          <div>
            <div className="field">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  checked={ms.enforceSequentialApproval !== false}
                  onChange={(e) =>
                    setConfigs((prev) => ({
                      ...prev,
                      measurement: { ...ms, enforceSequentialApproval: e.target.checked },
                    }))
                  }
                />
                <span>Enforce Sequential Approval (QC → IC.Q.A.D → Supplier)</span>
              </label>
            </div>

            <div className="table-wrapper" tabIndex={0} role="region" aria-label="Configuration data table" style={{ marginBottom: '1rem' }}>
              <table className="qms-table">
                <thead>
                  <tr>
                    <th>Stage</th>
                    <th>Required</th>
                    <th>Allowed Roles (comma-separated)</th>
                  </tr>
                </thead>
                <tbody>
                  {(ms.approvalWorkflow || []).map((st, idx) => (
                    <tr key={st.stage}>
                      <td><strong>{st.stage}</strong></td>
                      <td>
                        <input
                          type="checkbox"
                          disabled={!canEdit}
                          checked={st.required !== false}
                          onChange={(e) => {
                            const next = ms.approvalWorkflow.map((x, i) =>
                              i === idx ? { ...x, required: e.target.checked } : x
                            );
                            setConfigs((prev) => ({
                              ...prev,
                              measurement: { ...ms, approvalWorkflow: next },
                            }));
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          disabled={!canEdit}
                          value={(st.allowedRoles || []).join(', ')}
                          onChange={(e) => {
                            const next = ms.approvalWorkflow.map((x, i) =>
                              i === idx
                                ? {
                                    ...x,
                                    allowedRoles: e.target.value
                                      .split(',')
                                      .map((r) => r.trim())
                                      .filter(Boolean),
                                  }
                                : x
                            );
                            setConfigs((prev) => ({
                              ...prev,
                              measurement: { ...ms, approvalWorkflow: next },
                            }));
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {canEdit ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={saving}
                onClick={() => saveModuleConfig('measurement')}
              >
                <Save size={15} aria-hidden="true" />
                <span>Save Measurement Configuration</span>
              </button>
            ) : null}
          </div>
        ) : null}

        {tab === 'roles' ? (
          <div>
            {canEdit ? (
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="New custom role name..."
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  style={{ maxWidth: 280 }}
                />
                <button type="button" className="btn btn-secondary btn-sm" onClick={createCustomRole}>
                  <Plus size={14} aria-hidden="true" />
                  <span>Add Role</span>
                </button>
              </div>
            ) : null}

            {roles.map((r, rIdx) => (
              <div
                key={r.roleName}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '1rem',
                  marginBottom: '1rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div>
                    <strong>{r.roleName}</strong>
                    <div className="muted">{r.description}</div>
                  </div>
                  {canEdit ? (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={saving}
                      onClick={() => saveRole(r)}
                    >
                      <Save size={14} aria-hidden="true" />
                      <span>Save {r.roleName}</span>
                    </button>
                  ) : null}
                </div>

                <div className="table-wrapper" tabIndex={0} role="region" aria-label="Configuration data table">
                  <table className="qms-table">
                    <thead>
                      <tr>
                        <th>Capability</th>
                        <th>Permissions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['masterData', ['view', 'create', 'edit', 'archive']],
                        ['configuration', ['view', 'edit']],
                        ['users', ['view', 'create', 'edit']],
                        ['targetChart', ['view', 'create', 'edit', 'submit', 'approve', 'reject', 'archive', 'scopeAllLines']],
                        ['sizeSet', ['view', 'create', 'edit', 'submit', 'approve', 'reject', 'markNA', 'archive', 'scopeAllLines']],
                        ['sevenPoint', ['view', 'create', 'edit', 'submit', 'approve', 'reject', 'archive', 'scopeAllLines']],
                        ['measurement', ['view', 'create', 'edit', 'submit', 'approve', 'reject', 'archive', 'scopeAllLines']],
                        ['dashboard', ['view']],
                        ['exports', ['pdf', 'excel']],
                        ['auditLogs', ['view']],
                      ].map(([sec, actions]) => (
                        <tr key={sec}>
                          <td><strong>{sec}</strong></td>
                          <td>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                              {actions.map((act) => (
                                <label key={act} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem' }}>
                                  <input
                                    type="checkbox"
                                    disabled={!canEdit || r.roleName === 'Admin'}
                                    checked={Boolean(r.permissions?.[sec]?.[act])}
                                    onChange={() => toggleRolePerm(rIdx, sec, act)}
                                  />
                                  <span>{act}</span>
                                </label>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
