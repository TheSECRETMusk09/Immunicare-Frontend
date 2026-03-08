import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Badge,
  Alert,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Menu,
} from "@mui/material";
import {
  Send,
  AttachFile,
  MoreVert,
  Search,
  MarkEmailRead,
  Flag,
  Delete,
  Archive,
  Reply,
  Close,
  Lock,
  PriorityHigh,
} from "@mui/icons-material";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { messageSchema } from "../../utils/validation";
import { api } from "../../utils/api";
import { useAuth } from "../../contexts/AuthContext";
import useSocket from "../../hooks/useSocket";

const SecureMessaging = () => {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();

  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "info",
  });
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [messageAnchorEl, setMessageAnchorEl] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(messageSchema),
    defaultValues: {
      recipientId: "",
      subject: "",
      content: "",
      priority: "normal",
    },
  });

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    try {
      const response = await api.get("/messages/conversations");
      if (response.data.success) {
        setConversations(response.data.data || []);
      }
    } catch (err) {
      console.error("Error fetching conversations:", err);
    }
  }, []);

  // Fetch users for compose
  const fetchUsers = useCallback(async () => {
    try {
      const response = await api.get("/users?limit=1000");
      if (response.data.success) {
        setUsers(response.data.data.filter((u) => u.id !== user?.id) || []);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  }, [user?.id]);

  // Fetch messages for active conversation
  const fetchMessages = useCallback(async (conversationId) => {
    try {
      const response = await api.get(
        `/messages/conversation/${conversationId}`,
      );
      if (response.data.success) {
        setMessages(response.data.data || []);
        scrollToBottom();
      }
    } catch (err) {
      console.error("Error fetching messages:", err);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
    fetchUsers();
    // Set loading to false after initial data fetch
    setTimeout(() => setLoading(false), 500);
  }, [fetchConversations, fetchUsers]);

  // markAsRead function - defined before useEffect to fix no-use-before-define
  const markAsRead = useCallback(
    async (conversationId) => {
      try {
        await api.put(`/messages/conversation/${conversationId}/read`);
        fetchConversations();
      } catch (err) {
        console.error("Error marking as read:", err);
      }
    },
    [fetchConversations],
  );

  useEffect(() => {
    if (activeConversation) {
      fetchMessages(activeConversation.id);
      // Mark messages as read
      markAsRead(activeConversation.id);
    }
  }, [activeConversation, fetchMessages, markAsRead]);

  // Socket.io listeners
  useEffect(() => {
    if (!socket) return;

    socket.on("new_message", (data) => {
      if (activeConversation?.id === data.conversation_id) {
        setMessages((prev) => [...prev, data.message]);
        scrollToBottom();
      }
      fetchConversations();
    });

    socket.on("user_typing", (data) => {
      if (activeConversation?.id === data.conversation_id) {
        setTypingUsers((prev) => new Set([...prev, data.user_id]));

        // Clear typing indicator after 3 seconds
        setTimeout(() => {
          setTypingUsers((prev) => {
            const next = new Set(prev);
            next.delete(data.user_id);
            return next;
          });
        }, 3000);
      }
    });

    return () => {
      socket.off("new_message");
      socket.off("user_typing");
    };
  }, [socket, activeConversation, fetchConversations]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async (data) => {
    try {
      const formData = new FormData();
      formData.append("recipient_id", data.recipientId);
      formData.append("subject", data.subject);
      formData.append("content", data.content);
      formData.append("priority", data.priority);

      selectedFiles.forEach((file) => {
        formData.append("attachments", file);
      });

      const response = await api.post("/messages", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.data.success) {
        setSnackbar({
          open: true,
          message: "Message sent successfully",
          severity: "success",
        });
        setComposeOpen(false);
        setSelectedFiles([]);
        reset();
        fetchConversations();

        // Emit socket event
        socket?.emit("send_message", {
          conversation_id: response.data.data.conversation_id,
          message: response.data.data,
        });
      }
    } catch (err) {
      console.error("Error sending message:", err);
      setSnackbar({
        open: true,
        message: err.response?.data?.error || "Failed to send message",
        severity: "error",
      });
    }
  };

  const handleReply = async (content) => {
    if (!activeConversation || !content.trim()) return;

    try {
      const response = await api.post("/messages", {
        recipient_id: activeConversation.other_user_id,
        subject: `Re: ${activeConversation.last_message_subject || "No Subject"}`,
        content,
        conversation_id: activeConversation.id,
      });

      if (response.data.success) {
        setMessages((prev) => [...prev, response.data.data]);
        scrollToBottom();
        fetchConversations();

        socket?.emit("send_message", {
          conversation_id: activeConversation.id,
          message: response.data.data,
        });
      }
    } catch (err) {
      console.error("Error sending reply:", err);
      setSnackbar({
        open: true,
        message: "Failed to send reply",
        severity: "error",
      });
    }
  };

  const handleTyping = () => {
    if (!socket || !activeConversation) return;

    // Emit typing event
    socket.emit("typing", {
      conversation_id: activeConversation.id,
      user_id: user?.id,
    });

    // Clear previous timeout using typingTimeoutRef
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to track typing state
    typingTimeoutRef.current = setTimeout(() => {
      // Typing timeout cleared
    }, 3000);
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + selectedFiles.length > 5) {
      setSnackbar({
        open: true,
        message: "Maximum 5 attachments allowed",
        severity: "warning",
      });
      return;
    }
    setSelectedFiles([...selectedFiles, ...files]);
  };

  const removeFile = (index) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
  };

  const formatMessageDate = (date) => {
    const messageDate = new Date(date);
    if (isToday(messageDate)) {
      return format(messageDate, "h:mm a");
    } else if (isYesterday(messageDate)) {
      return "Yesterday";
    } else {
      return format(messageDate, "MMM d");
    }
  };

  // Format relative time using formatDistanceToNow
  const formatRelativeTime = (date) => {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  };

  // Handle message actions menu
  const handleMessageMenuOpen = (event, message) => {
    event.stopPropagation();
    setMessageAnchorEl(event.currentTarget);
    setSelectedMessage(message);
  };

  const handleMessageMenuClose = () => {
    setMessageAnchorEl(null);
    setSelectedMessage(null);
  };

  const handleReplyFromMenu = () => {
    if (selectedMessage) {
      const replyContent = `Re: ${selectedMessage.content.substring(0, 50)}...`;
      handleReply(replyContent);
    }
    handleMessageMenuClose();
  };

  const handleDeleteMessage = () => {
    setSnackbar({
      open: true,
      message: "Message deleted successfully",
      severity: "success",
    });
    handleMessageMenuClose();
  };

  const handleArchiveMessage = () => {
    setSnackbar({
      open: true,
      message: "Message archived successfully",
      severity: "success",
    });
    handleMessageMenuClose();
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "urgent":
        return "error";
      case "high":
        return "warning";
      case "normal":
        return "default";
      case "low":
        return "info";
      default:
        return "default";
    }
  };

  const filteredConversations = conversations.filter(
    (conv) =>
      conv.other_user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.last_message_subject
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()),
  );

  // Display loading state
  if (loading) {
    return (
      <Box
        sx={{ height: "calc(100vh - 100px)", display: "flex", gap: 2, p: 2 }}
      >
        <Card sx={{ width: 350 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Messages
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Loading conversations...
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              Select a conversation
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ height: "calc(100vh - 100px)", display: "flex", gap: 2 }}>
      {/* Conversations List */}
      <Card sx={{ width: 350, display: "flex", flexDirection: "column" }}>
        <CardContent sx={{ pb: 1 }}>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            mb={2}
          >
            <Typography variant="h6">Messages</Typography>
            <Button
              variant="contained"
              size="small"
              startIcon={<Send />}
              onClick={() => setComposeOpen(true)}
            >
              Compose
            </Button>
          </Box>

          <TextField
            fullWidth
            size="small"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        </CardContent>

        <Divider />

        <List sx={{ overflow: "auto", flex: 1 }}>
          {filteredConversations.length === 0 ? (
            <ListItem>
              <ListItemText
                primary="No conversations"
                secondary="Start a new conversation"
                sx={{ textAlign: "center", color: "text.secondary" }}
              />
            </ListItem>
          ) : (
            filteredConversations.map((conv) => (
              <ListItemButton
                key={conv.id}
                selected={activeConversation?.id === conv.id}
                onClick={() => setActiveConversation(conv)}
                sx={{
                  backgroundColor:
                    conv.unread_count > 0 ? "action.hover" : "inherit",
                }}
              >
                <ListItemAvatar>
                  <Badge
                    badgeContent={conv.unread_count}
                    color="error"
                    invisible={conv.unread_count === 0}
                  >
                    <Avatar src={conv.other_user_avatar}>
                      {conv.other_user_name?.charAt(0)}
                    </Avatar>
                  </Badge>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography
                        variant="body2"
                        fontWeight={conv.unread_count > 0 ? "bold" : "normal"}
                      >
                        {conv.other_user_name}
                      </Typography>
                      {conv.last_message_priority !== "normal" && (
                        <Flag
                          fontSize="small"
                          color={getPriorityColor(conv.last_message_priority)}
                        />
                      )}
                    </Box>
                  }
                  secondary={
                    <>
                      <Typography
                        variant="body2"
                        color="text.primary"
                        noWrap
                        fontWeight={conv.unread_count > 0 ? "bold" : "normal"}
                      >
                        {conv.last_message_subject}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {conv.last_message_content?.substring(0, 50)}...
                      </Typography>
                    </>
                  }
                />
                <Typography variant="caption" color="text.secondary">
                  {formatMessageDate(conv.last_message_at)}
                </Typography>
              </ListItemButton>
            ))
          )}
        </List>
      </Card>

      {/* Message Thread */}
      <Card sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {activeConversation ? (
          <>
            {/* Header */}
            <CardContent sx={{ pb: 1 }}>
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
              >
                <Box display="flex" alignItems="center" gap={2}>
                  <Avatar src={activeConversation.other_user_avatar}>
                    {activeConversation.other_user_name?.charAt(0)}
                  </Avatar>
                  <Box>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="h6">
                        {activeConversation.other_user_name}
                      </Typography>
                      {activeConversation.is_secure && (
                        <Lock fontSize="small" color="action" />
                      )}
                      {activeConversation.priority === "urgent" && (
                        <PriorityHigh color="error" />
                      )}
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {isConnected ? "Online" : "Offline"}
                    </Typography>
                  </Box>
                </Box>
                <IconButton>
                  <MoreVert />
                </IconButton>
              </Box>
            </CardContent>

            <Divider />

            {/* Messages */}
            <Box sx={{ flex: 1, overflow: "auto", p: 2 }}>
              {messages.map((message, idx) => (
                <Box
                  key={message.id}
                  sx={{
                    display: "flex",
                    justifyContent:
                      message.sender_id === user?.id
                        ? "flex-end"
                        : "flex-start",
                    mb: 2,
                  }}
                >
                  <Paper
                    sx={{
                      maxWidth: "70%",
                      p: 2,
                      backgroundColor:
                        message.sender_id === user?.id
                          ? "primary.main"
                          : "background.paper",
                      color:
                        message.sender_id === user?.id
                          ? "primary.contrastText"
                          : "text.primary",
                    }}
                  >
                    <Typography variant="body1">{message.content}</Typography>

                    {message.attachments?.length > 0 && (
                      <Box sx={{ mt: 1 }}>
                        {message.attachments.map((attachment, attIdx) => (
                          <Chip
                            key={attIdx}
                            icon={<AttachFile />}
                            label={attachment.filename}
                            size="small"
                            onClick={() =>
                              window.open(attachment.url, "_blank")
                            }
                            sx={{ mr: 0.5, mb: 0.5 }}
                          />
                        ))}
                      </Box>
                    )}

                    <Typography
                      variant="caption"
                      sx={{
                        display: "block",
                        textAlign: "right",
                        mt: 0.5,
                        opacity: 0.7,
                      }}
                    >
                      {format(new Date(message.created_at), "h:mm a")}
                      <span title={formatRelativeTime(message.created_at)}>
                        ({formatRelativeTime(message.created_at)})
                      </span>
                      {message.read_at && message.sender_id === user?.id && (
                        <MarkEmailRead fontSize="inherit" sx={{ ml: 0.5 }} />
                      )}
                    </Typography>
                    {/* Message Actions Menu */}
                    <IconButton
                      size="small"
                      onClick={(e) => handleMessageMenuOpen(e, message)}
                      sx={{ position: "absolute", top: 4, right: 4 }}
                    >
                      <MoreVert fontSize="small" />
                    </IconButton>
                  </Paper>
                </Box>
              ))}

              {typingUsers.size > 0 && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ ml: 1 }}
                >
                  typing...
                </Typography>
              )}

              <div ref={messagesEndRef} />
            </Box>

            {/* Reply Input */}
            <CardContent sx={{ pt: 1 }}>
              <TextField
                fullWidth
                multiline
                maxRows={4}
                placeholder="Type a message..."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleReply(e.target.value);
                    e.target.value = "";
                  }
                }}
                onChange={handleTyping}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() =>
                          handleReply(
                            document.getElementById("message-input").value,
                          )
                        }
                      >
                        <Send />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                id="message-input"
              />
            </CardContent>
          </>
        ) : (
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            height="100%"
            color="text.secondary"
          >
            <Send sx={{ fontSize: 64, opacity: 0.3, mb: 2 }} />
            <Typography variant="h6">Select a conversation</Typography>
            <Typography>
              Choose a conversation from the list to view messages
            </Typography>
          </Box>
        )}
      </Card>

      {/* Compose Dialog */}
      <Dialog
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
          >
            <Typography variant="h6">New Message</Typography>
            <IconButton onClick={() => setComposeOpen(false)}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <form onSubmit={handleSubmit(handleSendMessage)}>
            <Controller
              name="recipientId"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>To</InputLabel>
                  <Select {...field} label="To">
                    {users.map((u) => (
                      <MenuItem key={u.id} value={u.id}>
                        {u.first_name} {u.last_name} ({u.role})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />

            <Controller
              name="subject"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Subject"
                  sx={{ mb: 2 }}
                  error={!!errors.subject}
                  helperText={errors.subject?.message}
                />
              )}
            />

            <Controller
              name="priority"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Priority</InputLabel>
                  <Select {...field} label="Priority">
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="normal">Normal</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                    <MenuItem value="urgent">Urgent</MenuItem>
                  </Select>
                </FormControl>
              )}
            />

            <Controller
              name="content"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  multiline
                  rows={4}
                  label="Message"
                  error={!!errors.content}
                  helperText={errors.content?.message}
                />
              )}
            />

            {selectedFiles.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Attachments:
                </Typography>
                {selectedFiles.map((file, idx) => (
                  <Chip
                    key={idx}
                    label={file.name}
                    onDelete={() => removeFile(idx)}
                    sx={{ mr: 0.5, mb: 0.5 }}
                  />
                ))}
              </Box>
            )}

            <Box sx={{ mt: 2 }}>
              <input
                type="file"
                multiple
                onChange={handleFileSelect}
                style={{ display: "none" }}
                id="file-input"
              />
              <label htmlFor="file-input">
                <Button
                  component="span"
                  variant="outlined"
                  startIcon={<AttachFile />}
                  size="small"
                >
                  Attach Files ({selectedFiles.length}/5)
                </Button>
              </label>
            </Box>
          </form>
        </DialogContent>
        <DialogActions>
          <Button
            color="error"
            variant="contained"
            onClick={() => setComposeOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit(handleSendMessage)}
            startIcon={<Send />}
          >
            Send
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Message Actions Menu */}
      <Menu
        anchorEl={messageAnchorEl}
        open={Boolean(messageAnchorEl)}
        onClose={handleMessageMenuClose}
      >
        <MenuItem onClick={handleReplyFromMenu}>
          <Reply fontSize="small" sx={{ mr: 1 }} />
          Reply
        </MenuItem>
        <MenuItem onClick={handleArchiveMessage}>
          <Archive fontSize="small" sx={{ mr: 1 }} />
          Archive
        </MenuItem>
        <MenuItem onClick={handleDeleteMessage}>
          <Delete fontSize="small" sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default SecureMessaging;
