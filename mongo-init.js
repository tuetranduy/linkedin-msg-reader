// MongoDB initialization script
// This runs when the container is first created

db = db.getSiblingDB("linkedin_msg");

// Create application user with readWrite permissions
db.createUser({
  user: "app",
  pwd: "apppassword",
  roles: [{ role: "readWrite", db: "linkedin_msg" }],
});

// Create collections with schema validation
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["username", "passwordHash", "role"],
      properties: {
        username: { bsonType: "string" },
        passwordHash: { bsonType: "string" },
        role: { enum: ["admin", "user"] },
        createdAt: { bsonType: "date" },
      },
    },
  },
});

db.createCollection("conversations", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["title", "participants"],
      properties: {
        title: { bsonType: "string" },
        participants: { bsonType: "array" },
        messageCount: { bsonType: "int" },
        lastMessageDate: { bsonType: "date" },
        isVisible: { bsonType: "bool" },
      },
    },
  },
});

db.createCollection("messages");
db.createCollection("bookmarks");

// Create indexes
db.users.createIndex({ username: 1 }, { unique: true });
db.conversations.createIndex({ lastMessageDate: -1 });
db.messages.createIndex({ conversationId: 1 });
db.messages.createIndex({ content: "text" });
db.bookmarks.createIndex({ userId: 1 });
db.bookmarks.createIndex({ userId: 1, messageId: 1 }, { unique: true });

print("MongoDB initialized with collections and indexes");
