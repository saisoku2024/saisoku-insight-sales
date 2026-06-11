"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function HistoryPage() {

  const [history,setHistory] = useState<any[]>([]);

  useEffect(()=>{
    fetchHistory();
  },[]);

  const fetchHistory = async () => {

    const {data} = await supabase
      .from("product_accounts")
      .select("*")
      .eq("status","sold")
      .order("sold_at",{ascending:false});

    setHistory(data || []);

  };

  return (

    <div>

      <h1 className="text-3xl font-bold mb-6">
        Stock History
      </h1>

      <table className="w-full bg-white rounded-xl shadow">

        <thead>

          <tr className="border-b">
            <th className="p-3 text-left">Email</th>
            <th className="p-3 text-left">Profile</th>
            <th className="p-3 text-left">Sold To</th>
            <th className="p-3 text-left">Date</th>
          </tr>

        </thead>

        <tbody>

          {history.map((h)=>(
            <tr key={h.id} className="border-b">

              <td className="p-3">{h.email}</td>
              <td className="p-3">{h.profile}</td>
              <td className="p-3">{h.sold_to}</td>
              <td className="p-3">{h.sold_at}</td>

            </tr>
          ))}

        </tbody>

      </table>

    </div>

  );

}