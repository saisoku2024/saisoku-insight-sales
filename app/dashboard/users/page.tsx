"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

export default function UsersPage(){

const [users,setUsers] = useState<any[]>([])
const [page,setPage] = useState(1)
const [selectedUser,setSelectedUser] = useState<any>(null)
const [editUser,setEditUser] = useState<any>(null)

const limit = 50

async function loadUsers(){

const {data,error} = await supabase
.from("users")
.select("*")
.order("created_at",{ascending:false})
.range((page-1)*limit,page*limit-1)

if(error){
console.log(error)
return
}

setUsers(data || [])

}

async function deleteUser(id:string){

if(!confirm("Delete user?")) return

await supabase
.from("users")
.update({deleted_at:new Date()})
.eq("id",id)

loadUsers()

}

async function toggleUserStatus(user:any){

const newStatus = !user.is_active

await supabase
.from("users")
.update({is_active:newStatus})
.eq("id",user.id)

setSelectedUser({...user,is_active:newStatus})

loadUsers()

}

async function updateUser(){

await supabase
.from("users")
.update({
email:editUser.email,
phone:editUser.phone,
role:editUser.role
})
.eq("id",editUser.id)

setEditUser(null)

loadUsers()

}

useEffect(()=>{
loadUsers()
},[page])

return(

<div className="space-y-6">

<h1 className="text-xl font-semibold">
User Management
</h1>

<div className="bg-white border rounded-lg overflow-x-auto">

<table className="w-full text-sm">

<thead className="border-b bg-gray-50">

<tr>

<th className="p-3 text-left">No</th>
<th className="p-3 text-left">ID Telegram</th>
<th className="p-3 text-left">Username</th>
<th className="p-3 text-left">Role</th>
<th className="p-3 text-left">Last Login</th>
<th className="p-3 text-left">Status</th>
<th className="p-3 text-left">View</th>
<th className="p-3 text-left">Edit</th>
<th className="p-3 text-left">Delete</th>

</tr>

</thead>

<tbody>

{users.map((u,i)=>(

<tr key={u.id} className="border-b">

<td className="p-3">
{(page-1)*limit+i+1}
</td>

<td className="p-3">
{u.telegram_id || "-"}
</td>

<td className="p-3">
{u.username || "-"}
</td>

<td className="p-3">

<span className={`px-2 py-1 rounded text-xs

${u.role === "owner"
? "bg-red-100 text-red-700"
: u.role === "admin"
? "bg-blue-100 text-blue-700"
: u.role === "reseller"
? "bg-purple-100 text-purple-700"
: "bg-gray-100 text-gray-700"}

`}>

{u.role || "regular"}

</span>

</td>

<td className="p-3">
{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : "-"}
</td>

<td className="p-3">

<span className={`px-2 py-1 rounded text-xs

${u.is_active
? "bg-green-100 text-green-700"
: "bg-yellow-100 text-yellow-700"}

`}>

{u.is_active ? "Active" : "Suspend"}

</span>

</td>

<td className="p-3">

<button
onClick={()=>setSelectedUser(u)}
className="bg-blue-500 text-white px-2 py-1 rounded text-xs"
>
View
</button>

</td>

<td className="p-3">

<button
onClick={()=>setEditUser(u)}
className="bg-indigo-500 text-white px-2 py-1 rounded text-xs"
>
Edit
</button>

</td>

<td className="p-3">

<button
onClick={()=>deleteUser(u.id)}
className="bg-red-500 text-white px-2 py-1 rounded text-xs"
>
Delete
</button>

</td>

</tr>

))}

</tbody>

</table>

</div>

<div className="flex gap-2">

<button
onClick={()=>setPage(page-1)}
disabled={page===1}
className="border px-3 py-1 rounded"
>
Prev
</button>

<span>
Page {page}
</span>

<button
onClick={()=>setPage(page+1)}
className="border px-3 py-1 rounded"
>
Next
</button>

</div>

{/* VIEW USER */}

{selectedUser && (

<div className="fixed inset-0 bg-black/30 flex items-center justify-center">

<div className="bg-white w-[420px] rounded-lg p-6 shadow-lg">

<h2 className="text-lg font-semibold mb-4">
User Details
</h2>

<div className="grid grid-cols-2 gap-y-2 text-sm">

<div>User ID</div>
<div>{selectedUser.id}</div>

<div>Telegram ID</div>
<div>{selectedUser.telegram_id}</div>

<div>Username</div>
<div>{selectedUser.username}</div>

<div>Email</div>
<div>{selectedUser.email}</div>

<div>Phone</div>
<div>{selectedUser.phone}</div>

<div>Role</div>
<div>{selectedUser.role || "regular"}</div>

<div>Balance</div>
<div>Rp {selectedUser.balance}</div>

<div>Status</div>

<div>

<span className={`px-2 py-1 rounded text-xs

${selectedUser.is_active
? "bg-green-100 text-green-700"
: "bg-yellow-100 text-yellow-700"}

`}>

{selectedUser.is_active ? "Active" : "Suspend"}

</span>

</div>

</div>

<div className="flex justify-between mt-6">

<button
onClick={()=>toggleUserStatus(selectedUser)}
className={`px-4 py-2 rounded text-white

${selectedUser.is_active
? "bg-yellow-500"
: "bg-green-600"}

`}
>

{selectedUser.is_active ? "Suspend User" : "Activate User"}

</button>

<button
onClick={()=>setSelectedUser(null)}
className="border px-4 py-2 rounded"
>
Close
</button>

</div>

</div>

</div>

)}

{/* EDIT USER */}

{editUser && (

<div className="fixed inset-0 bg-black/30 flex items-center justify-center">

<div className="bg-white w-[420px] rounded-lg p-6 shadow-lg space-y-3">

<h2 className="text-lg font-semibold">
Edit User
</h2>

<input
value={editUser.email || ""}
onChange={(e)=>setEditUser({...editUser,email:e.target.value})}
placeholder="Email"
className="border w-full p-2 rounded"
/>

<input
value={editUser.phone || ""}
onChange={(e)=>setEditUser({...editUser,phone:e.target.value})}
placeholder="Phone"
className="border w-full p-2 rounded"
/>

<select
value={editUser.role || "regular"}
onChange={(e)=>setEditUser({...editUser,role:e.target.value})}
className="border w-full p-2 rounded"
>

<option value="owner">Owner</option>
<option value="admin">Admin</option>
<option value="reseller">Reseller</option>
<option value="regular">Regular</option>

</select>

<div className="flex justify-end gap-2 pt-3">

<button
onClick={()=>setEditUser(null)}
className="border px-3 py-2 rounded"
>
Cancel
</button>

<button
onClick={updateUser}
className="bg-green-600 text-white px-3 py-2 rounded"
>
Save
</button>

</div>

</div>

</div>

)}

</div>

)

}