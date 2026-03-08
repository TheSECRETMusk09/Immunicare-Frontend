import React, { useState, useEffect } from "react";
import { Card, Table, Badge, Button, Modal, Form } from "../UI";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

const RequestList = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewData, setReviewData] = useState({
    status: "",
    allocatedQuantity: "",
    reviewNotes: "",
  });
  const [filters, setFilters] = useState({ status: "", priority: "" });

  const isCityLevel = ["super_admin", "admin", "city_staff"].includes(
    user?.role,
  );

  useEffect(() => {
    fetchRequests();
  }, [filters]);

  useEffect(() => {
    if (id) {
      fetchRequestDetails(id);
    }
  }, [id]);

  const fetchRequests = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append("status", filters.status);
      if (filters.priority) params.append("priority", filters.priority);

      const response = await fetch(
        `/api/vaccine-supply/requests?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );
      const data = await response.json();
      if (data.success) {
        setRequests(data.requests);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError("Failed to fetch requests");
    } finally {
      setLoading(false);
    }
  };

  const fetchRequestDetails = async (requestId) => {
    try {
      const response = await fetch(
        `/api/vaccine-supply/requests/${requestId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );
      const data = await response.json();
      if (data.success) {
        setSelectedRequest(data.request);
      }
    } catch (err) {
      console.error("Failed to fetch request details:", err);
    }
  };

  const handleReview = async () => {
    try {
      const response = await fetch(
        `/api/vaccine-supply/requests/${selectedRequest.id}/review`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify(reviewData),
        },
      );
      const data = await response.json();
      if (data.success) {
        setShowReviewModal(false);
        fetchRequests();
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert("Failed to review request");
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      pending: "warning",
      under_review: "info",
      approved: "success",
      partially_fulfilled: "info",
      fulfilled: "success",
      rejected: "danger",
      cancelled: "secondary",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  const getPriorityBadge = (priority) => {
    const variants = {
      high: "danger",
      medium: "warning",
      low: "info",
    };
    return (
      <Badge variant={variants[priority] || "secondary"}>{priority}</Badge>
    );
  };

  if (loading) {
    return <div className="loading">Loading requests...</div>;
  }

  return (
    <div className="request-list">
      <div className="page-header">
        <h1>Vaccine Requests</h1>
        {isCityLevel && (
          <div className="filters">
            <Form.Select
              value={filters.status}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value })
              }
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="under_review">Under Review</option>
              <option value="approved">Approved</option>
              <option value="fulfilled">Fulfilled</option>
              <option value="rejected">Rejected</option>
            </Form.Select>
            <Form.Select
              value={filters.priority}
              onChange={(e) =>
                setFilters({ ...filters, priority: e.target.value })
              }
            >
              <option value="">All Priority</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Form.Select>
          </div>
        )}
      </div>

      <Card>
        <Card.Body>
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Request #</Table.HeaderCell>
                <Table.HeaderCell>Barangay</Table.HeaderCell>
                <Table.HeaderCell>Vaccine</Table.HeaderCell>
                <Table.HeaderCell>Requested</Table.HeaderCell>
                <Table.HeaderCell>Allocated</Table.HeaderCell>
                <Table.HeaderCell>Priority</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell>Date</Table.HeaderCell>
                <Table.HeaderCell>Actions</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {requests.map((request) => (
                <Table.Row key={request.id}>
                  <Table.Cell>{request.request_number}</Table.Cell>
                  <Table.Cell>{request.requesting_barangay_name}</Table.Cell>
                  <Table.Cell>{request.vaccine_name}</Table.Cell>
                  <Table.Cell>{request.requested_quantity}</Table.Cell>
                  <Table.Cell>{request.allocated_quantity || "-"}</Table.Cell>
                  <Table.Cell>{getPriorityBadge(request.priority)}</Table.Cell>
                  <Table.Cell>{getStatusBadge(request.status)}</Table.Cell>
                  <Table.Cell>
                    {new Date(request.request_date).toLocaleDateString()}
                  </Table.Cell>
                  <Table.Cell>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        navigate(`/vaccine-supply/requests/${request.id}`)
                      }
                    >
                      View
                    </Button>
                    {isCityLevel && request.status === "pending" && (
                      <Button
                        variant="primary"
                        size="sm"
                        className="ml-2"
                        onClick={() => {
                          setSelectedRequest(request);
                          setShowReviewModal(true);
                        }}
                      >
                        Review
                      </Button>
                    )}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
          {requests.length === 0 && (
            <div className="empty-state">
              <p>No requests found</p>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Review Modal */}
      <Modal show={showReviewModal} onHide={() => setShowReviewModal(false)}>
        <Modal.Header>
          <Modal.Title>Review Request</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedRequest && (
            <div className="request-details mb-4">
              <p>
                <strong>Request #:</strong> {selectedRequest.request_number}
              </p>
              <p>
                <strong>Barangay:</strong>{" "}
                {selectedRequest.requesting_barangay_name}
              </p>
              <p>
                <strong>Vaccine:</strong> {selectedRequest.vaccine_name}
              </p>
              <p>
                <strong>Requested Quantity:</strong>{" "}
                {selectedRequest.requested_quantity}
              </p>
              <p>
                <strong>Priority:</strong>{" "}
                {getPriorityBadge(selectedRequest.priority)}
              </p>
            </div>
          )}
          <Form.Group>
            <Form.Label>Status</Form.Label>
            <Form.Select
              value={reviewData.status}
              onChange={(e) =>
                setReviewData({ ...reviewData, status: e.target.value })
              }
            >
              <option value="">Select Status</option>
              <option value="under_review">Under Review</option>
              <option value="approved">Approve</option>
              <option value="rejected">Reject</option>
            </Form.Select>
          </Form.Group>
          {reviewData.status === "approved" && (
            <Form.Group>
              <Form.Label>Allocated Quantity</Form.Label>
              <Form.Input
                type="number"
                value={reviewData.allocatedQuantity}
                onChange={(e) =>
                  setReviewData({
                    ...reviewData,
                    allocatedQuantity: e.target.value,
                  })
                }
                placeholder="Enter allocated quantity"
              />
            </Form.Group>
          )}
          <Form.Group>
            <Form.Label>Notes</Form.Label>
            <Form.Textarea
              value={reviewData.reviewNotes}
              onChange={(e) =>
                setReviewData({ ...reviewData, reviewNotes: e.target.value })
              }
              placeholder="Add review notes"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="cancel" onClick={() => setShowReviewModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleReview}>
            Submit Review
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default RequestList;
