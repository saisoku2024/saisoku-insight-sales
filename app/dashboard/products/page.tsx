"use client";

import { useCallback, useEffect, useState } from "react";
import { ActionNotice, type ActionNoticeState } from "@/components/dashboard/action-notice";
import { useIsViewer, viewerOnlyTitle } from "@/components/dashboard/panel-access-context";
import { supabase } from "@/lib/supabase/client";
import { adminWrite } from "@/services/admin/admin-api-client";
import type { Product } from "@/types";

function currencyIDR(v: number) {
  return `Rp ${Number(v || 0).toLocaleString("id-ID")}`;
}

export default function ProductsPage() {
  const isViewer = useIsViewer();
  const [products, setProducts] = useState<Product[]>([]);
  const [stocks, setStocks] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<string[]>([]);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [discount, setDiscount] = useState("");
  const [modal, setModal] = useState("");
  const [duration, setDuration] = useState("");
  const [description, setDescription] = useState("");
  const [tos, setTos] = useState("");
  const [promoActive, setPromoActive] = useState(false);
  const [promoReguler, setPromoReguler] = useState("");
  const [promoReseller, setPromoReseller] = useState("");
  const [promoLabel, setPromoLabel] = useState("");

  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [hasMore, setHasMore] = useState(false);

  const [sortField, setSortField] = useState("created_at");
  const [sortAsc, setSortAsc] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [notice, setNotice] = useState<ActionNoticeState>(null);

  const showError = (message: string) => setNotice({ type: "error", message });
  const showSuccess = (message: string) => setNotice({ type: "success", message });
  const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : "Unknown error";

  const resetForm = () => {
    setCode("");
    setName("");
    setPrice("");
    setDiscount("");
    setModal("");
    setDuration("");
    setDescription("");
    setTos("");
    setPromoActive(false);
    setPromoReguler("");
    setPromoReseller("");
    setPromoLabel("");
    setEditingProduct(null);
  };

  const fetchProducts = useCallback(async () => {
    const from = (page - 1) * pageSize;
    const to = page * pageSize;

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order(sortField, { ascending: sortAsc })
      .range(from, to);

    if (error) {
      console.error("fetchProducts error:", error);
      return;
    }

    setProducts(data?.slice(0, pageSize) || []);
    setHasMore((data?.length || 0) > pageSize);
  }, [page, sortField, sortAsc]);

  async function fetchStockCount() {
    const { data, error } = await supabase
      .from("product_accounts")
      .select("product_id,status");

    if (error) {
      console.error("fetchStockCount error:", error);
      return;
    }

    const map: Record<string, number> = {};

    data?.forEach((row: { product_id: string; status: string }) => {
      if (row.status === "available") {
        map[row.product_id] = (map[row.product_id] || 0) + 1;
      }
    });

    setStocks(map);
  }

  function sortBy(field: string) {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
    setPage(1);
  }

  async function addProduct() {
    if (!code || !name || !price || !duration) {
      showError("Field tidak boleh kosong");
      return false;
    }

    try {
      await adminWrite<Product>("/api/admin/products", {
        body: {
          product_code: code,
          name,
          price_normal: Number(price),
          reseller_discount: Number(discount || 0),
          modal: Number(modal || 0),
          duration_days: Number(duration),
          description,
          tos_description: tos,
          is_promo_active: promoActive,
          promo_price_reguler: Number(promoReguler || 0),
          promo_price_reseller: Number(promoReseller || 0),
          promo_label: promoLabel,
          template_message: "Email: {email}\nPassword: {password}",
        },
      });
    } catch (error) {
      console.error("addProduct error:", error);
      showError(`Gagal menambah produk: ${getErrorMessage(error)}`);
      return false;
    }

    resetForm();
    await fetchProducts();
    showSuccess("Produk berhasil ditambahkan.");
    return true;
  }

  function startEdit(p: Product) {
    setEditingProduct(p);
    setCode(p.product_code || "");
    setName(p.name || "");
    setPrice(String(p.price_normal ?? ""));
    setDiscount(String(p.reseller_discount ?? ""));
    setModal(String(p.modal ?? ""));
    setDuration(String(p.duration_days ?? ""));
    setDescription(p.description || "");
    setTos(p.tos_description || "");
    setPromoActive(Boolean(p.is_promo_active));
    setPromoReguler(String(p.promo_price_reguler ?? ""));
    setPromoReseller(String(p.promo_price_reseller ?? ""));
    setPromoLabel(p.promo_label || "");
    setShowModal(true);
  }

  async function updateProduct() {
    if (!editingProduct) return;

    try {
      await adminWrite<Product>("/api/admin/products", {
        method: "PATCH",
        body: {
          id: editingProduct.id,
        product_code: code,
          name,
        price_normal: Number(price),
        reseller_discount: Number(discount || 0),
        modal: Number(modal || 0),
        duration_days: Number(duration),
          description,
        tos_description: tos,
        is_promo_active: promoActive,
        promo_price_reguler: Number(promoReguler || 0),
        promo_price_reseller: Number(promoReseller || 0),
        promo_label: promoLabel,
        },
      });
    } catch (error) {
      console.error("updateProduct error:", error);
      showError(`Gagal update produk: ${getErrorMessage(error)}`);
      return;
    }

    setShowModal(false);
    resetForm();
    showSuccess("Produk berhasil diupdate.");
    void fetchProducts();
  }

  async function deleteProduct(id: string) {
    const confirmDelete = confirm("Delete product?");
    if (!confirmDelete) return;

    try {
      await adminWrite("/api/admin/products", {
        method: "DELETE",
        body: { ids: [id] },
      });
    } catch (error) {
      console.error("deleteProduct error:", error);
      showError(`Gagal delete produk: ${getErrorMessage(error)}`);
      return;
    }

    showSuccess("Produk berhasil dihapus.");
    void fetchProducts();
  }

  async function deleteSelected() {
    if (selected.length === 0) {
      showError("No product selected");
      return;
    }

    const confirmDelete = confirm("Delete selected products?");
    if (!confirmDelete) return;

    try {
      await adminWrite("/api/admin/products", {
        method: "DELETE",
        body: { ids: selected },
      });
    } catch (error) {
      console.error("deleteSelected error:", error);
      showError(`Gagal delete product terpilih: ${getErrorMessage(error)}`);
      return;
    }

    setSelected([]);
    showSuccess("Produk terpilih berhasil dihapus.");
    void fetchProducts();
  }

  async function toggleProduct(id: string, current: boolean) {
    try {
      await adminWrite<Product>("/api/admin/products", {
        method: "PATCH",
        body: { id, is_active: !current },
      });
    } catch (error) {
      console.error("toggleProduct error:", error);
      showError(`Gagal ubah status produk: ${getErrorMessage(error)}`);
      return;
    }

    showSuccess("Status produk berhasil diubah.");
    void fetchProducts();
  }

  const nextPage = () => setPage(page + 1);
  const prevPage = () => {
    if (page > 1) setPage(page - 1);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchProducts();
    void fetchStockCount();
  }, [fetchProducts]);

  const thClass = "p-3 cursor-pointer select-none text-left";
  const btnPrimary =
    "border-[3px] border-[var(--insight-border)] bg-[var(--insight-blue)] px-4 py-2 text-xl leading-none text-white shadow-[4px_4px_0_var(--insight-shadow)] transition hover:-translate-y-0.5";
  const btnDanger =
    "border-[3px] border-[var(--insight-border)] bg-red-600 px-4 py-2 text-xl leading-none text-white shadow-[4px_4px_0_var(--insight-shadow)] transition hover:-translate-y-0.5";
  const viewerDisabledClass = " disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0";
  const inputClass =
    "h-10 w-full border-[3px] border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 text-xl text-[var(--insight-text)] outline-none";
  const labelClass =
    "mb-1 block text-base leading-none tracking-wide text-[var(--insight-muted)]";
  const textareaClass =
    "h-24 w-full resize-none border-[3px] border-[var(--insight-border)] bg-[var(--insight-panel)] p-3 text-xl text-[var(--insight-text)] outline-none";

  return (
    <div className="space-y-6 text-[var(--insight-text)]">
      {/* HEADER */}
      <div className="insight-card p-4">
        <span className="inline-block border-[3px] border-[var(--insight-border)] bg-violet-100 px-3 py-1 text-lg leading-none text-violet-800">
          PRODUCT MANAGEMENT
        </span>
        <h1 className="mt-3 text-[34px] leading-none text-[var(--insight-text)]">
          Product List
        </h1>
        <p className="mt-1 text-xl leading-none text-[var(--insight-muted)]">
          Manage all products available in the system.
        </p>
      </div>

      <ActionNotice notice={notice} onDismiss={() => setNotice(null)} />

      {/* TOOLBAR */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => {
            if (isViewer) return;
            resetForm();
            setShowAddModal(true);
          }}
          disabled={isViewer}
          title={isViewer ? viewerOnlyTitle : undefined}
          className={btnPrimary + viewerDisabledClass}
        >
          + Add Product
        </button>

        <button
          onClick={() => void deleteSelected()}
          disabled={isViewer}
          title={isViewer ? viewerOnlyTitle : undefined}
          className={btnDanger + viewerDisabledClass}
        >
          Delete Selected
        </button>
      </div>

      {/* TABLE */}
      <div className="insight-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[var(--insight-panel)] text-[var(--insight-muted)]">
              <tr>
                <th className="p-3">
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelected(products.map((p) => p.id));
                      } else {
                        setSelected([]);
                      }
                    }}
                  />
                </th>
                <th className={thClass} onClick={() => sortBy("product_code")}>Code</th>
                <th className={thClass} onClick={() => sortBy("name")}>Name</th>
                <th className={thClass} onClick={() => sortBy("price_normal")}>Price</th>
                <th className={thClass} onClick={() => sortBy("modal")}>Modal</th>
                <th className="p-3 text-left">Profit</th>
                <th className={thClass} onClick={() => sortBy("reseller_discount")}>Reseller Disc</th>
                <th className="p-3 text-left">Promo</th>
                <th className={thClass} onClick={() => sortBy("duration_days")}>Duration</th>
                <th className="p-3 text-left">Stock</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Action</th>
              </tr>
            </thead>

            <tbody>
              {products.map((p) => {
                const stock = stocks[p.id] || 0;
                const profit = Number(p.price_normal || 0) - Number(p.modal || 0);

                return (
                  <tr
                    key={p.id}
                    className="transition hover:bg-blue-50 dark:hover:bg-slate-800/60"
                  >
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selected.includes(p.id)}
                        onChange={() => {
                          if (selected.includes(p.id)) {
                            setSelected(selected.filter((id) => id !== p.id));
                          } else {
                            setSelected([...selected, p.id]);
                          }
                        }}
                      />
                    </td>
                    <td className="p-3">{p.product_code}</td>
                    <td className="p-3">{p.name}</td>
                    <td className="p-3">{currencyIDR(Number(p.price_normal || 0))}</td>
                    <td className="p-3">{currencyIDR(Number(p.modal || 0))}</td>
                    <td className="p-3">{currencyIDR(profit)}</td>
                    <td className="p-3">{currencyIDR(Number(p.reseller_discount || 0))}</td>
                    <td className="p-3">
                      {p.is_promo_active ? (
                        <div className="space-y-1">
                          <span className="inline-block border-[2px] border-[var(--insight-border)] bg-red-100 px-2 py-0.5 text-base leading-none text-red-700">
                            PROMO
                          </span>
                          <div className="text-base leading-tight text-[var(--insight-muted)]">
                            R: {currencyIDR(Number(p.promo_price_reguler || 0))}
                          </div>
                          <div className="text-base leading-tight text-[var(--insight-muted)]">
                            S: {currencyIDR(Number(p.promo_price_reseller || 0))}
                          </div>
                        </div>
                      ) : "-"}
                    </td>
                    <td className="p-3">{p.duration_days} days</td>
                    <td className="p-3">{stock}</td>
                    <td className="p-3">
                      <button
                        onClick={() => void toggleProduct(p.id, p.is_active)}
                        disabled={isViewer}
                        title={isViewer ? viewerOnlyTitle : undefined}
                        className={`border-[3px] border-[var(--insight-border)] px-3 py-1 text-lg leading-none text-white shadow-[4px_4px_0_var(--insight-shadow)] ${
                          p.is_active ? "bg-green-600" : "bg-gray-500"
                        }${viewerDisabledClass}`}
                      >
                        {p.is_active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (isViewer) return;
                            startEdit(p);
                          }}
                          disabled={isViewer}
                          title={isViewer ? viewerOnlyTitle : undefined}
                          className={"border-[3px] border-[var(--insight-border)] bg-amber-400 px-3 py-1 text-lg leading-none text-black shadow-[4px_4px_0_var(--insight-shadow)]" + viewerDisabledClass}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => void deleteProduct(p.id)}
                          disabled={isViewer}
                          title={isViewer ? viewerOnlyTitle : undefined}
                          className={"border-[3px] border-[var(--insight-border)] bg-red-600 px-3 py-1 text-lg leading-none text-white shadow-[4px_4px_0_var(--insight-shadow)]" + viewerDisabledClass}
                        >
                          Del
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {products.length === 0 && (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-xl text-[var(--insight-muted)]">
                    No products found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PAGINATION */}
      <div className="flex items-center gap-3">
        <button
          onClick={prevPage}
          disabled={page === 1}
          className="insight-button px-4 py-2 text-lg leading-none disabled:opacity-40"
        >
          Prev
        </button>
        <div className="px-4 py-2 text-lg">Page {page}</div>
        <button
          onClick={nextPage}
          disabled={!hasMore}
          className="insight-button px-4 py-2 text-lg leading-none disabled:opacity-40"
        >
          Next
        </button>
      </div>

      {/* ADD PRODUCT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="insight-card w-[540px] max-w-[95vw] max-h-[90vh] overflow-y-auto p-6">
            <h2 className="mb-4 text-[28px] leading-none text-[var(--insight-text)]">
              Add Product
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className={labelClass}>Product Code</span>
                <input className={inputClass} placeholder="Contoh: DS1B" value={code} onChange={(e) => setCode(e.target.value)} />
              </label>
              <label>
                <span className={labelClass}>Product Name</span>
                <input className={inputClass} placeholder="Contoh: Disney+ Premium" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label>
                <span className={labelClass}>Price Normal</span>
                <input type="number" className={inputClass} placeholder="Harga jual user" value={price} onChange={(e) => setPrice(e.target.value)} />
              </label>
              <label>
                <span className={labelClass}>Reseller Discount</span>
                <input type="number" className={inputClass} placeholder="Potongan reseller" value={discount} onChange={(e) => setDiscount(e.target.value)} />
              </label>
              <label>
                <span className={labelClass}>Modal / Harga Beli</span>
                <input type="number" className={inputClass} placeholder="Harga modal" value={modal} onChange={(e) => setModal(e.target.value)} />
              </label>
              <label>
                <span className={labelClass}>Duration Days</span>
                <input type="number" className={inputClass} placeholder="Masa aktif hari" value={duration} onChange={(e) => setDuration(e.target.value)} />
              </label>
              <label className="flex items-end gap-2 border-[3px] border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 py-2">
                <input type="checkbox" checked={promoActive} onChange={(e) => setPromoActive(e.target.checked)} className="h-5 w-5 accent-red-600" />
                <span className={labelClass}>Promo Active</span>
              </label>
              <label>
                <span className={labelClass}>Promo Label</span>
                <input className={inputClass} placeholder="Kosong = nama produk" value={promoLabel} onChange={(e) => setPromoLabel(e.target.value)} />
              </label>
              <label>
                <span className={labelClass}>Promo Reguler</span>
                <input type="number" className={inputClass} placeholder="Harga promo reguler" value={promoReguler} onChange={(e) => setPromoReguler(e.target.value)} />
              </label>
              <label>
                <span className={labelClass}>Promo Reseller</span>
                <input type="number" className={inputClass} placeholder="Harga promo reseller" value={promoReseller} onChange={(e) => setPromoReseller(e.target.value)} />
              </label>
            </div>

            <label className="mt-3 block">
              <span className={labelClass}>Description / Detail Produk</span>
              <textarea
                className={textareaClass}
                placeholder="Tuliskan benefit, plan, device, garansi, dll."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>

            <label className="mt-3 block">
              <span className={labelClass}>Terms / Catatan Pengiriman</span>
              <textarea
                className={textareaClass}
                placeholder="S&K, info login, rules claim garansi, dan catatan untuk buyer."
                value={tos}
                onChange={(e) => setTos(e.target.value)}
              />
            </label>

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => { setShowAddModal(false); resetForm(); }}
                className="insight-button px-4 py-2 text-lg leading-none"
              >
                Cancel
              </button>
              <button
                onClick={async () => { const ok = await addProduct(); if (ok) setShowAddModal(false); }}
                disabled={isViewer}
                title={isViewer ? viewerOnlyTitle : undefined}
                className={"border-[3px] border-[var(--insight-border)] bg-green-600 px-4 py-2 text-lg leading-none text-white shadow-[4px_4px_0_var(--insight-shadow)]" + viewerDisabledClass}
              >
                Create Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="insight-card w-[540px] max-w-[95vw] max-h-[90vh] overflow-y-auto p-6">
            <h2 className="mb-4 text-[28px] leading-none text-[var(--insight-text)]">
              Edit Product
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className={labelClass}>Product Code</span>
                <input className={inputClass} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Contoh: DS1B" />
              </label>
              <label>
                <span className={labelClass}>Product Name</span>
                <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama produk" />
              </label>
              <label>
                <span className={labelClass}>Price Normal</span>
                <input type="number" className={inputClass} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Harga jual user" />
              </label>
              <label>
                <span className={labelClass}>Reseller Discount</span>
                <input type="number" className={inputClass} value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="Potongan reseller" />
              </label>
              <label>
                <span className={labelClass}>Modal / Harga Beli</span>
                <input type="number" className={inputClass} value={modal} onChange={(e) => setModal(e.target.value)} placeholder="Harga modal" />
              </label>
              <label>
                <span className={labelClass}>Duration Days</span>
                <input type="number" className={inputClass} value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Masa aktif hari" />
              </label>
              <label className="flex items-end gap-2 border-[3px] border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 py-2">
                <input type="checkbox" checked={promoActive} onChange={(e) => setPromoActive(e.target.checked)} className="h-5 w-5 accent-red-600" />
                <span className={labelClass}>Promo Active</span>
              </label>
              <label>
                <span className={labelClass}>Promo Label</span>
                <input className={inputClass} value={promoLabel} onChange={(e) => setPromoLabel(e.target.value)} placeholder="Kosong = nama produk" />
              </label>
              <label>
                <span className={labelClass}>Promo Reguler</span>
                <input type="number" className={inputClass} value={promoReguler} onChange={(e) => setPromoReguler(e.target.value)} placeholder="Harga promo reguler" />
              </label>
              <label>
                <span className={labelClass}>Promo Reseller</span>
                <input type="number" className={inputClass} value={promoReseller} onChange={(e) => setPromoReseller(e.target.value)} placeholder="Harga promo reseller" />
              </label>
            </div>

            <label className="mt-3 block">
              <span className={labelClass}>Description / Detail Produk</span>
              <textarea
                className={textareaClass}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tuliskan benefit, plan, device, garansi, dll."
              />
            </label>

            <label className="mt-3 block">
              <span className={labelClass}>Terms / Catatan Pengiriman</span>
              <textarea
                className={textareaClass}
                value={tos}
                onChange={(e) => setTos(e.target.value)}
                placeholder="S&K, info login, rules claim garansi, dan catatan untuk buyer."
              />
            </label>

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="insight-button px-4 py-2 text-lg leading-none"
              >
                Cancel
              </button>
              <button
                onClick={() => void updateProduct()}
                disabled={isViewer}
                title={isViewer ? viewerOnlyTitle : undefined}
                className={"border-[3px] border-[var(--insight-border)] bg-[var(--insight-blue)] px-4 py-2 text-lg leading-none text-white shadow-[4px_4px_0_var(--insight-shadow)]" + viewerDisabledClass}
              >
                Update Product
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
