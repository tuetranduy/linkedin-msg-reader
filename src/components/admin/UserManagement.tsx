import { useState, useEffect, useCallback } from "react";
import { apiClient, adminResetPassword } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Edit2, X, Check, User, KeyRound } from "lucide-react";

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
  const [resetPasswordId, setResetPasswordId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState("");
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

  const handleResetPassword = async (id: number) => {
    if (resetPassword.length < 6) {
      alert("Password must be at least 6 characters");
      return;
    }
    try {
      await adminResetPassword(id, resetPassword);
      setResetPasswordId(null);
      setResetPassword("");
      alert("Password reset successfully");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to reset password");
    }
  };

  if (isLoading) {
    return <div className="p-4">Loading users...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg lg:text-xl font-semibold">User Management</h2>
        <Button onClick={() => setShowForm(true)} size="sm">
          <Plus className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">Add User</span>
        </Button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="p-3 lg:p-4 bg-muted rounded-lg space-y-3"
        >
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
              className="px-3 py-2 rounded-md border bg-background text-sm"
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

      {/* Desktop: Table view */}
      <div className="hidden md:block border rounded-lg overflow-hidden">
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
                  ) : resetPasswordId === user.id ? (
                    <div className="flex justify-end items-center gap-2">
                      <Input
                        type="password"
                        placeholder="New password"
                        value={resetPassword}
                        onChange={(e) => setResetPassword(e.target.value)}
                        className="h-8 w-32"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleResetPassword(user.id)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setResetPasswordId(null);
                          setResetPassword("");
                        }}
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
                          setResetPasswordId(user.id);
                          setResetPassword("");
                        }}
                        title="Reset Password"
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
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

      {/* Mobile: Card view */}
      <div className="md:hidden space-y-3">
        {users.map((user) => (
          <div key={user.id} className="border rounded-lg p-3 bg-card">
            {editingId === user.id ? (
              <div className="space-y-3">
                <Input
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  placeholder="Username"
                  className="h-9"
                />
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-md border bg-background text-sm"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleUpdate(user.id)}
                    className="flex-1"
                  >
                    <Check className="h-4 w-4 mr-1" /> Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingId(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="font-medium">{user.username}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          user.role === "admin"
                            ? "bg-primary/20 text-primary"
                            : "bg-muted"
                        }`}
                      >
                        {user.role}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                {resetPasswordId === user.id ? (
                  <div className="flex flex-col gap-2 mt-2">
                    <Input
                      type="password"
                      placeholder="New password (min 6 chars)"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      className="h-9"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleResetPassword(user.id)}
                        className="flex-1"
                      >
                        <Check className="h-4 w-4 mr-1" /> Reset
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setResetPasswordId(null);
                          setResetPassword("");
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setResetPasswordId(user.id);
                        setResetPassword("");
                      }}
                      title="Reset Password"
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>
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
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
