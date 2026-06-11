"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

function currencyIDR(v: number) {
  return `Rp ${Number(v || 0).toLocaleString("id-ID")}`;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [stocks, setStocks] = useState<any>({});
  const [selected, setSelected] = useState<any[]>([]);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [discount, setDiscount] = useState("");
  const [modal, setModal] = useState("");
  const [duration, setDuration] = useState("");
  const [description, setDescription] = useState("");
  const [tos, setTos] = useState("");

  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [hasMore, setHasMore] = useState(false);

  const [sortField, setSortField] = useState("created_at");
  const [sortAsc, setSortAsc] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const [editingProduct, setEditingProduct] = useState<any>(null);

  useEffect(() => {
    fetchProducts();
    fetchStockCount();
  }, [page, sortField, sortAsc]);

  const resetForm = () => {
    setCode("");
    setName("");
    setPrice("");
    setDiscount("");
    setModal("");
    setDuration("");
    setDescription("");
    setTos("");
    setEditingProduct(null);
  };

  /* FETCH PRODUCTS */
  const fetchProducts = async () => {
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
  };

  /* FETCH STOCK */
  const fetchStockCount = async () => {
    const { data, error } = await supabase
      .from("product_accounts")
      .select("product_id,status");

    if (error) {
      console.error("fetchStockCount error:", error);
      return;
    }

    const map: any = {};

    data?.forEach((row: any) => {
      if (row.status === "available") {
        map[row.product_id] = (map[row.product_id] || 0) + 1;
      }
    });

    setStocks(map);
  };

  /* SORT */
  const sortBy = (field: any) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
    setPage(1);
  };

  /* ADD PRODUCT */
  const addProduct = async () => {
    if (!code || !name || !price || !duration) {
      alert("Field tidak boleh kosong");
      return false;
    }

    const { error } = await supabase.from("products").insert({
      product_code: code,
      name: name,
      price_normal: Number(price),
      reseller_discount: Number(discount || 0),
      modal: Number(modal || 0),
      duration_days: Number(duration),
      description: description,
      tos_description: tos,
      template_message: "Email: {email}\nPassword: {password}",
      is_active: true,
    });

    if (error) {
      console.error("addProduct error:", error);
      alert(`Gagal menambah produk: ${error.message}`);
      return false;
    }

    resetForm();
    await fetchProducts();
    return true;
  };

  /* START EDIT */
  const startEdit = (p: any) => {
    setEditingProduct(p);

    setCode(p.product_code || "");
    setName(p.name || "");
    setPrice(String(p.price_normal ?? ""));
    setDiscount(String(p.reseller_discount ?? ""));
    setModal(String(p.modal ?? ""));
    setDuration(String(p.duration_days ?? ""));
    setDescription(p.description || "");
    setTos(p.tos_description || "");

    setShowModal(true);
  };

  /* UPDATE PRODUCT */
  const updateProduct = async () => {
    if (!editingProduct) return;

    const { error } = await supabase
      .from("products")
      .update({
        product_code: code,
        name: name,
        price_normal: Number(price),
        reseller_discount: Number(discount || 0),
        modal: Number(modal || 0),
        duration_days: Number(duration),
        description: description,
        tos_description: tos,
      })
      .eq("id", editingProduct.id);

    if (error) {
      console.error("updateProduct error:", error);
      alert(`Gagal update produk: ${error.message}`);
      return;
    }

    setShowModal(false);
    resetForm();
    await fetchProducts();
  };

  /* DELETE SINGLE */
  const deleteProduct = async (id: any) => {
    const confirmDelete = confirm("Delete product?");
    if (!confirmDelete) return;

    const { error } = await supabase.from("products").delete().eq("id", id);

    if (error) {
      console.error("deleteProduct error:", error);
      alert(`Gagal delete produk: ${error.message}`);
      return;
    }

    await fetchProducts();
  };

  /* BULK DELETE */
  const deleteSelected = async () => {
    if (selected.length === 0) {
      alert("No product selected");
      return;
    }

    const confirmDelete = confirm("Delete selected products?");
    if (!confirmDelete) return;

    const { error } = await supabase
      .from("products")
      .delete()
      .in("id", selected);

    if (error) {
      console.error("deleteSelected error:", error);
      alert(`Gagal delete product terpilih: ${error.message}`);
      return;
    }

    setSelected([]);
    await fetchProducts();
  };

  /* TOGGLE ACTIVE */
  const toggleProduct = async (id: any, current: any) => {
    const { error } = await supabase
      .from("products")
      .update({
        is_active: !current,
      })
      .eq("id", id);

    if (error) {
      console.error("toggleProduct error:", error);
      alert(`Gagal ubah status produk: ${error.message}`);
      return;
    }

    await fetchProducts();
  };

  /* PAGINATION */
  const nextPage = () => setPage(page + 1);

  const prevPage = () => {
    if (page > 1) setPage(page - 1);
  };

  return (
    <div className="max-w-6xl mx-auto text-sm">
      <h1 className="text-2xl font-bold mb-6">Product Management</h1>

      <div className="flex gap-3 mb-4">
        <button
          onClick={() => {
            resetForm();
            setShowAddModal(true);
          }}
          className="h-10 px-5 bg-black text-white rounded-lg hover:bg-gray-800 transition"
        >
          + Add Product
        </button>

        <button
          onClick={deleteSelected}
          className="h-10 px-5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
        >
          Delete Selected
        </button>
      </div>

      <table className="w-full bg-white rounded-xl shadow-sm text-sm overflow-hidden">
        <thead className="bg-gray-50 text-gray-700">
          <tr className="border-b">
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

            <th className="p-3 cursor-pointer" onClick={() => sortBy("product_code")}>
              Code
            </th>
            <th className="p-3 cursor-pointer" onClick={() => sortBy("name")}>
              Name
            </th>
            <th className="p-3 cursor-pointer" onClick={() => sortBy("price_normal")}>
              Price
            </th>
            <th className="p-3 cursor-pointer" onClick={() => sortBy("modal")}>
              Modal
            </th>
            <th className="p-3">Profit</th>
            <th className="p-3 cursor-pointer" onClick={() => sortBy("reseller_discount")}>
              Reseller Discount
            </th>
            <th className="p-3 cursor-pointer" onClick={() => sortBy("duration_days")}>
              Duration
            </th>
            <th className="p-3">Stock</th>
            <th className="p-3">Status</th>
            <th className="p-3">Action</th>
          </tr>
        </thead>

        <tbody>
          {products.map((p) => {
            const stock = stocks[p.id] || 0;
            const profit = Number(p.price_normal || 0) - Number(p.modal || 0);

            return (
              <tr key={p.id} className="border-b hover:bg-gray-50 transition cursor-pointer">
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
                <td className="p-3">
                  {currencyIDR(Number(p.reseller_discount || 0))}
                </td>
                <td className="p-3">{p.duration_days} days</td>
                <td className="p-3">{stock}</td>

                <td className="p-3">
                  <button
                    onClick={() => toggleProduct(p.id, p.is_active)}
                    className={`px-3 py-1 text-xs font-medium rounded-full text-white ${
                      p.is_active ? "bg-green-500" : "bg-gray-500"
                    }`}
                  >
                    {p.is_active ? "Active" : "Inactive"}
                  </button>
                </td>

                <td className="p-3 flex gap-2">
                  <button
                    onClick={() => startEdit(p)}
                    className="bg-blue-500 text-white px-3 py-1 rounded-md hover:bg-blue-600 transition"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => deleteProduct(p.id)}
                    className="bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600 transition"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}

          {products.length === 0 && (
            <tr>
              <td colSpan={11} className="p-6 text-center text-gray-500">
                No products found
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="flex gap-4 mt-6">
        <button
          onClick={prevPage}
          disabled={page === 1}
          className={`px-4 py-2 rounded ${
            page === 1 ? "bg-gray-300 text-gray-500" : "bg-gray-300"
          }`}
        >
          Prev
        </button>

        <div className="px-4 py-2">Page {page}</div>

        <button
          onClick={nextPage}
          disabled={!hasMore}
          className={`px-4 py-2 rounded ${
            hasMore
              ? "bg-black text-white"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
        >
          Next
        </button>
      </div>

      {/* ADD PRODUCT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-[520px] shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Add Product</h2>

            <div className="grid grid-cols-2 gap-3">
              <input
                className="border p-2 rounded"
                placeholder="Product Code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />

              <input
                className="border p-2 rounded"
                placeholder="Product name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              <input
                type="number"
                className="border p-2 rounded"
                placeholder="Price normal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />

              <input
                type="number"
                className="border p-2 rounded"
                placeholder="Reseller discount"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />

              <input
                type="number"
                className="border p-2 rounded"
                placeholder="Modal / harga beli"
                value={modal}
                onChange={(e) => setModal(e.target.value)}
              />

              <input
                type="number"
                className="border p-2 rounded"
                placeholder="Duration days"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>

            <textarea
              className="border p-2 rounded w-full mt-3"
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            <textarea
              className="border p-2 rounded w-full mt-3"
              placeholder="Terms of Service"
              value={tos}
              onChange={(e) => setTos(e.target.value)}
            />

            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
                className="px-4 py-2 border rounded"
              >
                Cancel
              </button>

              <button
                onClick={async () => {
                  const ok = await addProduct();
                  if (ok) setShowAddModal(false);
                }}
                className="px-4 py-2 bg-green-600 text-white rounded"
              >
                Create Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-[520px] shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Edit Product</h2>

            <div className="grid grid-cols-2 gap-3">
              <input
                className="border p-2 rounded"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Product Code"
              />

              <input
                className="border p-2 rounded"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
              />

              <input
                type="number"
                className="border p-2 rounded"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Price"
              />

              <input
                type="number"
                className="border p-2 rounded"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="Discount"
              />

              <input
                type="number"
                className="border p-2 rounded"
                value={modal}
                onChange={(e) => setModal(e.target.value)}
                placeholder="Modal / harga beli"
              />

              <input
                type="number"
                className="border p-2 rounded"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="Duration"
              />
            </div>

            <textarea
              className="border p-2 rounded w-full mt-3"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description"
            />

            <textarea
              className="border p-2 rounded w-full mt-3"
              value={tos}
              onChange={(e) => setTos(e.target.value)}
              placeholder="Terms of Service"
            />

            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="px-4 py-2 border rounded"
              >
                Cancel
              </button>

              <button
                onClick={updateProduct}
                className="px-4 py-2 bg-blue-600 text-white rounded"
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