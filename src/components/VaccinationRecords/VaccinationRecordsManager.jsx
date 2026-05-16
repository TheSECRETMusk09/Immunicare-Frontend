import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Card,

  Typography ,
  Button    ,
  TextField,
  Table    ,
  TableBody,
  TableCell,
  TableContainer,
  TableHead     ,
  TableRow ,
  TablePagination,
  Paper          ,
  IconButton,
  Chip      ,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid         ,
  FormControl,
  InputLabel ,
  Select    ,
  MenuItem,
  InputAdornment,
  Skeleton      ,
  Alert   ,
  Snackbar,
  Tooltip ,
  Divider,
  Avatar ,




  Checkbox,


} from "@mui/material";
import {
  Search,
  FilterList,

  Visibility,


  Person    ,
  PictureAsPdf ,
  TableChart   ,

  Close ,
  Refresh     ,
  CheckCircle,

  AccessTime,

  ChildCare,
} from "@mui/icons-material";
import { format, parseISO, differenceInMonths } from "date-fns";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { api } from "../../utils/api";

const VaccinationRecordsManager = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVaccine, setSelectedVaccine] = useState("");
  const [selectedDateRange, setSelectedDateRange] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Selection for bulk actions
  const [selectedRecords, setSelectedRecords] = useState([]);

  // Detail view
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  // Certificate generation
                                                useState(false);
  const [generatingCertificate, setGeneratingCertificate] = useState(false);

  // Vaccines list for filter
  const [vaccines, setVaccines] = useState([]);

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "info",
  });

  // Fetch records
  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        page: page + 1,
        limit: rowsPerPage,
        search: searchQuery || undefined,
        vaccine_id: selectedVaccine || undefined,
        date_range: selectedDateRange !== "all" ? selectedDateRange : undefined,
        status: selectedStatus || undefined,
      };

      const response = await api.get("/vaccinations/records", { params });

      if (response.data.success) {
        setRecords(response.data.data || []);
        setTotalCount(response.data.total || 0);
      } else {
        throw new Error(response.data.error || "Failed to fetch records");
      }
    } catch (err) {
      console.error("Error fetching vaccination records:", err);
      setError(err.message || "Failed to load vaccination records");
    } finally {
      setLoading(false);
    }
  }, [
    page,
    rowsPerPage,
    searchQuery,
    selectedVaccine,
    selectedDateRange,
    selectedStatus,
  ]);

  // Fetch vaccines for filter
  useEffect(() => {
    const fetchVaccines = async () => {
      try {
        const response = await api.get("/vaccinations/vaccines");
        if (response.data.success) {
          setVaccines(response.data.data || []);
        }
      } catch (err) {
        console.error("Error fetching vaccines:", err);
      }
    };
    fetchVaccines();
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Handle search
  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
    setPage(0);
  };

  // Handle selection
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedRecords(records.map((r) => r.id));
    } else {
      setSelectedRecords([]);
    }
  };

  const handleSelectRecord = (id) => {
    if (selectedRecords.includes(id)) {
      setSelectedRecords(selectedRecords.filter((rid) => rid !== id));
    } else {
      setSelectedRecords([...selectedRecords, id]);
    }
  };

  // View record details
  const handleViewDetails = (record) => {
    setSelectedRecord(record);
    setDetailOpen(true);
  };

  // Generate certificate
  const generateCertificate = async (record) => {
    setGeneratingCertificate(true);
    try {
      const doc = new jsPDF("portrait", "mm", "a4");

      // Add certificate header
      doc.setFontSize(24);
      doc.setTextColor(0, 102, 204);
      doc.text("Immunization Certificate", 105, 30, { align: "center" });

      // Add decorative line
      doc.setDrawColor(0, 102, 204);
      doc.setLineWidth(1);
      doc.line(20, 35, 190, 35);

      // Certificate content
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);

      doc.text("This certifies that", 20, 50);

      doc.setFontSize(16);
      doc.setFont(undefined, "bold");
      doc.text(
        `${record.infant_first_name} ${record.infant_last_name}`,
        20,
        60,
      );

      doc.setFontSize(12);
      doc.setFont(undefined, "normal");
      doc.text(
        `Date of Birth: ${format(parseISO(record.infant_date_of_birth), "MMMM d, yyyy")}`,
        20,
        70,
      );

      doc.text("has been vaccinated with:", 20, 85);

      doc.setFontSize(14);
      doc.setFont(undefined, "bold");
      doc.text(record.vaccine_name, 20, 95);

      doc.setFontSize(12);
      doc.setFont(undefined, "normal");
      doc.text(`Dose Number: ${record.dose_number}`, 20, 105);
      doc.text(
        `Date Administered: ${format(parseISO(record.administered_date), "MMMM d, yyyy")}`,
        20,
        115,
      );
      doc.text(
        `Administered By: ${record.administered_by_name || "Healthcare Provider"}`,
        20,
        125,
      );
      doc.text(`Batch Number: ${record.batch_number || "N/A"}`, 20, 135);

      // Next dose information
      if (record.next_dose_due) {
        doc.text(
          `Next Dose Due: ${format(parseISO(record.next_dose_due), "MMMM d, yyyy")}`,
          20,
          150,
        );
      }

      // Footer
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(
        "This certificate is generated electronically and is valid without signature.",
        20,
        270,
      );
      doc.text(
        `Generated on: ${format(new Date(), "MMMM d, yyyy HH:mm")}`,
        20,
        275,
      );
      doc.text("Immunicare Vaccination Management System", 20, 280);

      // Save PDF
      doc.save(
        `immunization-certificate-${record.infant_last_name}-${format(new Date(), "yyyyMMdd")}.pdf`,
      );

      setSnackbar({
        open: true,
        message: "Certificate downloaded successfully",
        severity: "success",
      });
    } catch (err) {
      console.error("Error generating certificate:", err);
      setSnackbar({
        open: true,
        message: "Failed to generate certificate",
        severity: "error",
      });
    } finally {
      setGeneratingCertificate(false);
    }
  };

  // Export records
  const exportRecords = async (format) => {
    try {
      const response = await api.get("/analytics/export", {
        params: {
          type: "vaccinations",
          format,
          ids:
            selectedRecords.length > 0 ? selectedRecords.join(",") : undefined,
        },
        responseType: format === "csv" ? "blob" : "json",
      });

      if (format === "csv") {
        const blob = new Blob([response.data], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute(
          "download",
          `vaccination-records-${format(new Date(), "yyyyMMdd")}.csv`,
        );
        document.body.appendChild(link);
        link.click();
        link.remove();
      }

      setSnackbar({
        open: true,
        message: "Records exported successfully",
        severity: "success",
      });
    } catch (err) {
      console.error("Error exporting records:", err);
      setSnackbar({
        open: true,
        message: "Failed to export records",
        severity: "error",
      });
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedVaccine("");
    setSelectedDateRange("all");
    setSelectedStatus("");
    setPage(0);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "success";
      case "scheduled":
        return "info";
      case "overdue":
        return "error";
      case "pending":
        return "warning";
      default:
        return "default";
    }
  };

  if (error) {
    return(
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button
          variant="contained"
          onClick={fetchRecords}
          startIcon={<Refresh />}
        >
          Retry
        </Button>
      </Box>)
     ;
  }

  return(
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Typography variant="h4" component="h1" fontWeight="bold">
          Vaccination Records
        </Typography>
        <Box display="flex" gap={1}>
          {selectedRecords.length > 0 &&(
            <Button
              variant="outlined"
              startIcon={<TableChart />}
              onClick={() => exportRecords("csv")}
            >
              Export Selected ({selectedRecords.length})
            </Button>)
           }
          <Button
            variant="contained"
            startIcon={<FilterList />}
            onClick={() => setShowFilters(!showFilters)}
          >
            Filters
          </Button>
        </Box>
      </Box>

      {/* Filters */}
      {showFilters &&(
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Search"
                value={searchQuery}
                onChange={handleSearch}
                InputProps={{
                  startAdornment:(
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>)
                   ,
                }}
                placeholder="Search by name..."
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Vaccine</InputLabel>
                <Select
                  value={selectedVaccine}
                  onChange={(e) => setSelectedVaccine(e.target.value)}
                  label="Vaccine"
                >
                  <MenuItem value="">All Vaccines</MenuItem>
                  {vaccines.map((v) =>(
                    <MenuItem key={v.id} value={v.id}>
                      {v.name}
                    </MenuItem>)
                   )}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Date Range</InputLabel>
                <Select
                  value={selectedDateRange}
                  onChange={(e) => setSelectedDateRange(e.target.value)}
                  label="Date Range"
                >
                  <MenuItem value="all">All Time</MenuItem>
                  <MenuItem value="today">Today</MenuItem>
                  <MenuItem value="week">This Week</MenuItem>
                  <MenuItem value="month">This Month</MenuItem>
                  <MenuItem value="quarter">This Quarter</MenuItem>
                  <MenuItem value="year">This Year</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                fullWidth
                variant="outlined"
                onClick={clearFilters}
                startIcon={<Close />}
              >
                Clear Filters
              </Button>
            </Grid>
          </Grid>
        </Paper>)
       }

      {/* Records Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={
                      selectedRecords.length === records.length &&
                      records.length > 0
                    }
                    indeterminate={
                      selectedRecords.length > 0 &&
                      selectedRecords.length < records.length
                    }
                    onChange={handleSelectAll}
                  />
                </TableCell>
                <TableCell>Infant</TableCell>
                <TableCell>Vaccine</TableCell>
                <TableCell>Dose</TableCell>
                <TableCell>Date Administered</TableCell>
                <TableCell>Age at Vaccination</TableCell>
                <TableCell>Administered By</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ?
                                                      (Array.from(new Array(rowsPerPage)).map((_,idx)=>(
                  <TableRow key={idx}>
                    {Array.from(new Array(9)).map((_, colIdx) =>(
                      <TableCell key={colIdx}>
                        <Skeleton variant="text" />
                      </TableCell>)
                     )}
                  </TableRow>)
                 ))
                : records.length === 0 ?(
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                    <Typography color="textSecondary">
                      No vaccination records found
                    </Typography>
                  </TableCell>
                </TableRow>)
                :
                           (records.map((record)=>(
                  <TableRow
                    key={record.id}
                    hover
                    selected={selectedRecords.includes(record.id)}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedRecords.includes(record.id)}
                        onChange={() => handleSelectRecord(record.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            bgcolor: "primary.main",
                          }}
                        >
                          <ChildCare sx={{ fontSize: 16 }} />
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {record.infant_first_name} {record.infant_last_name}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            DOB:{" "}
                            {format(
                              parseISO(record.infant_date_of_birth),
                              "MMM d, yyyy",
                            )}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {record.vaccine_name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={`Dose ${record.dose_number}`}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      {format(
                        parseISO(record.administered_date),
                        "MMM d, yyyy",
                      )}
                    </TableCell>
                    <TableCell>
                      {differenceInMonths(
                        parseISO(record.administered_date),
                        parseISO(record.infant_date_of_birth),
                      )}{" "}
                      months
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <Person
                          sx={{ fontSize: 16, color: "text.secondary" }}
                        />
                        <Typography variant="body2">
                          {record.administered_by_name || "Unknown"}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={record.status || "Completed"}
                        color={getStatusColor(record.status)}
                        size="small"
                        icon={
                          record.status === "completed" ?(
                            <CheckCircle />)
                            :(
                            <AccessTime />)

                        }
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          onClick={() => handleViewDetails(record)}
                        >
                          <Visibility fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Download Certificate">
                        <IconButton
                          size="small"
                          onClick={() => generateCertificate(record)}
                          disabled={generatingCertificate}
                        >
                          <PictureAsPdf fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>)
                 ))
               }
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[5, 10, 25, 50]}
        />
      </Card>

      {/* Record Detail Dialog */}
      <Dialog
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
          >
            <Typography variant="h6">Vaccination Record Details</Typography>
            <IconButton onClick={() => setDetailOpen(false)} size="small">
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedRecord &&(
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="textSecondary">
                  Infant
                </Typography>
                <Typography variant="body1">
                  {selectedRecord.infant_first_name}{" "}
                  {selectedRecord.infant_last_name}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  DOB:{" "}
                  {format(
                    parseISO(selectedRecord.infant_date_of_birth),
                    "MMMM d, yyyy",
                  )}
                </Typography>
              </Grid>

              <Grid item xs={12}>
                <Divider />
              </Grid>

              <Grid item xs={6}>
                <Typography variant="subtitle2" color="textSecondary">
                  Vaccine
                </Typography>
                <Typography variant="body1">
                  {selectedRecord.vaccine_name}
                </Typography>
              </Grid>

              <Grid item xs={6}>
                <Typography variant="subtitle2" color="textSecondary">
                  Dose Number
                </Typography>
                <Typography variant="body1">
                  {selectedRecord.dose_number}
                </Typography>
              </Grid>

              <Grid item xs={6}>
                <Typography variant="subtitle2" color="textSecondary">
                  Date Administered
                </Typography>
                <Typography variant="body1">
                  {format(
                    parseISO(selectedRecord.administered_date),
                    "MMMM d, yyyy",
                  )}
                </Typography>
              </Grid>

              <Grid item xs={6}>
                <Typography variant="subtitle2" color="textSecondary">
                  Batch Number
                </Typography>
                <Typography variant="body1">
                  {selectedRecord.batch_number || "N/A"}
                </Typography>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle2" color="textSecondary">
                  Administered By
                </Typography>
                <Typography variant="body1">
                  {selectedRecord.administered_by_name || "Unknown"}
                </Typography>
              </Grid>

              {selectedRecord.notes &&(
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Notes
                  </Typography>
                  <Typography variant="body2">
                    {selectedRecord.notes}
                  </Typography>
                </Grid>)
               }
            </Grid>)
           }
        </DialogContent>
        <DialogActions>
          <Button
            color="error"
            variant="contained"
            onClick={() => setDetailOpen(false)}
          >
            Close
          </Button>
          <Button
            variant="contained"
            startIcon={<PictureAsPdf />}
            onClick={() => {
              setDetailOpen(false);
              generateCertificate(selectedRecord);
            }}
            disabled={generatingCertificate}
          >
            Download Certificate
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
    </Box>)
   ;
};

export default VaccinationRecordsManager;