import { useEffect, useState } from 'react'
import { API_BASE_URL } from '../config'
import EmptyState from '../components/EmptyState'
import {
  CategoryIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  CloseIcon,
  CheckIcon,
} from '../components/Icons'

const ALL_SIZES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]

export default function CategoriesPage() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [categoryName, setCategoryName] = useState('')
  const [selectedSizes, setSelectedSizes] = useState([6, 7, 8, 9, 10])
  const [alertMsg, setAlertMsg] = useState({ type: '', text: '' })

  const loadCategories = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE_URL}/categories`)
      if (res.ok) {
        const data = await res.json()
        setCategories(data.categories || [])
      }
    } catch (err) {
      console.error(err)
      setAlertMsg({ type: 'error', text: 'Failed to load categories.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCategories()
  }, [])

  const openAddModal = () => {
    setEditingCategory(null)
    setCategoryName('')
    setSelectedSizes([6, 7, 8, 9, 10])
    setShowModal(true)
  }

  const openEditModal = (cat) => {
    setEditingCategory(cat)
    setCategoryName(cat.category_name)
    setSelectedSizes(cat.sizes || [])
    setShowModal(true)
  }

  const toggleSize = (size) => {
    if (selectedSizes.includes(size)) {
      setSelectedSizes(selectedSizes.filter((s) => s !== size))
    } else {
      setSelectedSizes([...selectedSizes, size].sort((a, b) => a - b))
    }
  }

  const selectAllSizes = () => {
    setSelectedSizes([...ALL_SIZES])
  }

  const clearAllSizes = () => {
    setSelectedSizes([])
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!categoryName.trim()) {
      setAlertMsg({ type: 'error', text: 'Category name is required.' })
      return
    }
    if (selectedSizes.length === 0) {
      setAlertMsg({ type: 'error', text: 'Please select at least one footwear size for this category.' })
      return
    }

    try {
      const url = editingCategory
        ? `${API_BASE_URL}/categories/${editingCategory.id}`
        : `${API_BASE_URL}/categories`
      const method = editingCategory ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category_name: categoryName.trim(),
          sizes: selectedSizes,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || 'Operation failed')
      }

      setShowModal(false)
      setAlertMsg({
        type: 'success',
        text: editingCategory ? 'Category updated.' : 'Category created successfully.',
      })
      loadCategories()
    } catch (err) {
      setAlertMsg({ type: 'error', text: err.message || 'Failed to save category.' })
    }
  }

  const handleDelete = async (catId, name) => {
    if (!window.confirm(`Are you sure you want to delete category "${name}"?`)) return
    try {
      const res = await fetch(`${API_BASE_URL}/categories/${catId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Delete failed')
      setAlertMsg({ type: 'success', text: data.message })
      loadCategories()
    } catch (err) {
      setAlertMsg({ type: 'error', text: err.message || 'Delete failed.' })
    }
  }

  return (
    <div className="erp-page-container">
      {/* Page Header */}
      <div className="erp-page-header">
        <div>
          <h1 className="page-main-title">Category Management</h1>
          <p className="page-sub-title">Configure footwear categories and allowed sizes (Kids 1-5, Adults 6-12, etc.).</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={openAddModal}>
            <PlusIcon size={14} />
            <span>+ Add Category</span>
          </button>
        </div>
      </div>

      {alertMsg.text && (
        <div className={`erp-alert-banner ${alertMsg.type}`}>
          <span>{alertMsg.text}</span>
          <button type="button" className="alert-close" onClick={() => setAlertMsg({ type: '', text: '' })}>
            <CloseIcon size={12} />
          </button>
        </div>
      )}

      {/* Categories Grid Table */}
      <div className="erp-card table-card">
        <div className="erp-table-responsive">
          <table className="erp-table">
            <thead>
              <tr>
                <th style={{ width: '45px' }}>#</th>
                <th>Category Name</th>
                <th>Configured Sizes</th>
                <th>Status</th>
                <th style={{ textAlign: 'center', width: '100px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="table-loading">Loading categories...</td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan="5">
                    <EmptyState
                      title="No Categories Configured"
                      description="Create footwear categories like Men, Women, Kids, Formal, Sports."
                      actionLabel="+ Add Category"
                      onAction={openAddModal}
                    />
                  </td>
                </tr>
              ) : (
                categories.map((c, idx) => (
                  <tr key={c.id}>
                    <td>{idx + 1}</td>
                    <td>
                      <div className="table-main-text font-bold">{c.category_name}</div>
                    </td>
                    <td>
                      <div className="table-sizes-chips">
                        {c.sizes?.map((sz) => (
                          <span key={sz} className="size-mini-badge">
                            Size {sz}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge ${c.status === 'active' ? 'paid' : 'critical'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div className="table-actions-inline">
                        <button
                          type="button"
                          className="btn-icon"
                          title="Edit Category"
                          onClick={() => openEditModal(c)}
                        >
                          <EditIcon size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon btn-icon-danger"
                          title="Delete / Deactivate"
                          onClick={() => handleDelete(c.id, c.category_name)}
                        >
                          <TrashIcon size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT CATEGORY MODAL */}
      {showModal && (
        <div className="erp-modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="erp-modal-box category-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingCategory ? 'Edit Category' : 'Add New Category'}</h3>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setShowModal(false)}
                aria-label="Close modal"
              >
                <CloseIcon size={14} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="modal-body form-grid">
                <div className="form-group">
                  <label className="form-label">Category Name *</label>
                  <input
                    type="text"
                    required
                    className="erp-input"
                    placeholder="e.g. Men Shoes, Women Sandals, Kids Sports"
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="form-group category-size-section">
                  <div className="category-size-header">
                    <div className="category-size-title-group">
                      <label className="category-size-title">Available Footwear Sizes *</label>
                      <p className="category-size-desc">
                        Choose the sizes available for products in this category.
                      </p>
                    </div>
                    <span className="category-size-count-pill" id="selected-size-counter">
                      Selected: <strong>{selectedSizes.length} / {ALL_SIZES.length}</strong>
                    </span>
                  </div>

                  <div className="category-size-toolbar">
                    <button
                      type="button"
                      className="category-size-action-btn"
                      onClick={selectAllSizes}
                      title="Select all 15 footwear sizes"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      className="category-size-action-btn"
                      onClick={clearAllSizes}
                      title="Clear all selected sizes"
                    >
                      Clear All
                    </button>
                  </div>

                  <div
                    className="category-size-grid"
                    role="group"
                    aria-label="Available Footwear Sizes"
                  >
                    {ALL_SIZES.map((sz) => {
                      const isSelected = selectedSizes.includes(sz)
                      return (
                        <button
                          key={sz}
                          type="button"
                          role="checkbox"
                          aria-checked={isSelected}
                          aria-label={`Size ${sz}, ${isSelected ? 'selected' : 'not selected'}`}
                          className={`category-size-chip ${isSelected ? 'selected' : ''}`}
                          onClick={() => toggleSize(sz)}
                        >
                          {isSelected && <CheckIcon size={14} className="chip-check-icon" />}
                          <span>Size {sz}</span>
                        </button>
                      )
                    })}
                  </div>

                  {selectedSizes.length === 0 && (
                    <div className="size-selection-warning">
                      <span>Please select at least 1 size to save this category.</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={selectedSizes.length === 0 || !categoryName.trim()}
                >
                  {editingCategory ? 'Save Changes' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
