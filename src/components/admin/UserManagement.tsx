import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Edit2, X, Check } from "lucide-react";

interface User {
  id: number;
  username: string;
  role: "admin" | "user";
  created_at: string;
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    role: "user",
  });
  const [error, setError] = useState("");

  const loadUsers = useCallback(async () => {
    try {
      const data = await apiClient<{ users: User[] }>("/users");
      setUsers(data.users);
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await apiClient("/users", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      setShowForm(false);
      setFormData({ username: "", password: "", role: "user" });
      loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this user?")) return;
    try {
      await apiClient(`/users/${id}`, { method: "DELETE" });
      loadUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete user");
    }
  };

  const handleUpdate = async (id: number) => {
    try {
      await apiClient(`/users/${id}`, {
        method: "PUT",
        body: JSON.stringify(formData),
      });
      setEditingId(null);
      setFormData({ username: "", password: "", role: "user" });
      loadUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update user");
    }
  };

  if (isLoading) {
    return <div className="p-4">Loading users...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">User Management</h2>
        <Button onClick={() => setShowForm(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add User
        </Button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="p-4 bg-muted rounded-lg space-y-3"
        >
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="grid grid-cols-3 gap-3">
            <Input
              placeholder="Username"
              value={formData.username}
              onChange={(e) =>
                setFormData({ ...formData, username: e.target.value })
              }
              required
            />
            <Input
              type="password"
              placeholder="Password (min 6 chars)"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              required
            />
            <select
              value={formData.role}
              onChange={(e) =>
                setFormData({ ...formData, role: e.target.value })
              }
              className="px-3 py-2 rounded-md border bg-background"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              Create
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-2 text-left">Username</th>
              <th className="px-4 py-2 text-left">Role</th>
              <th className="px-4 py-2 text-left">Created</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t">
                <td className="px-4 py-2">
                  {editingId === user.id ? (
                    <Input
                      value={formData.username}
                      onChange={(e) =>
                        setFormData({ ...formData, username: e.target.value })
                      }
                      className="h-8"
                    />
                  ) : (
                    user.username
                  )}
                </td>
                <td className="px-4 py-2">
                  {editingId === user.id ? (
                    <select
                      value={formData.role}
                      onChange={(e) =>
                        setFormData({ ...formData, role: e.target.value })
                      }
                      className="px-2 py-1 rounded border bg-background"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  ) : (
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        user.role === "admin"
                          ? "bg-primary/20 text-primary"
                          : "bg-muted"
                      }`}
                    >
                      {user.role}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-muted-foreground text-sm">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-2 text-right">
                  {editingId === user.id ? (
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleUpdate(user.id)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(user.id);
                          setFormData({
                            username: user.username,
                            password: "",
                            role: user.role,
                          });
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(user.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
