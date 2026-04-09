import React, { lazy, Suspense, useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import BACKEND_URL from "../config";
import { getStoredToken } from "@/config/auth";
import { fillPDFForm } from "../utils/pdfFormFiller";
const Page = lazy(() => import("SuperAdmin/Page"));
declare global {
    interface Window {
        Razorpay: any;
    }
}

const dummyTableData = [
    {
        sNo: 1,
        aldCompanyName: "N/A",
        aldCompanyCode: "N/A",
        location: "N/A",
        unitName: "N/A",
        contractedMD: "N/A",
        recordedMD: "N/A",
        minBillingDemand: "N/A",
        demandForBilling: "N/A",
        openingReadingDate: "N/A",
        openingReading: "N/A",
        closingReadingDate: "N/A",
        closingReading: "N/A",
        consumptionUnits: "N/A",
        unitRate: "N/A",
        demandCharges: "N/A",
        demandPenalCharges: "N/A",
        energyCharges: "N/A",
        imcCharges: "N/A",
        totalCharges: "N/A",
        status: "N/A",
        billMonth: 0,
        billYear: 0,
        billingPeriod: "N/A",
    },
];

const filterPaymentStatusOptions = [
    { value: "paid", label: "Paid" },
    { value: "overdue", label: "Overdue" },
];

const bulkPaymentStatusOptions = [
    { value: "paid", label: "Paid" },
    { value: "unpaid", label: "Unpaid" },
];

export default function Postpaid() {
    const navigate = useNavigate();
    const [amountRange, setAmountRange] = useState("");
    const [paymentStatus, setPaymentStatus] = useState("");
    const [search, setSearch] = useState("");
    const [selectedDate, setSelectedDate] = useState("");
    const [dateRange, setDateRange] = useState<[string, string]>(["", ""]);
    const [_errorMessgae, _setErrors] = useState<any[]>([]);

    const [amountRangeOptions, setAmountRangeOptions] = useState<
        Array<{ value: string; label: string; min?: number; max?: number }>
    >([{ value: "", label: "Select Amount Range" }]);

    const [_isProcessingPayment, setIsProcessingPayment] = useState(false);
    const [paymentError, setPaymentError] = useState("");

    const [isGeneratingBills, setIsGeneratingBills] = useState(false);
    const [billGenerationMessage, setBillGenerationMessage] = useState("");

    const [isBulkStatusModalOpen, setIsBulkStatusModalOpen] = useState(false);
    const [isInvoiceLoadingModalOpen, setIsInvoiceLoadingModalOpen] =
        useState(false);
    const [bulkStatusSelection, setBulkStatusSelection] = useState("");

    const [selectedRows, setSelectedRows] = useState<string[]>([]);

    const [appliedFilters, setAppliedFilters] = useState<string[]>([]);

    const [viewLoadingRowId, setViewLoadingRowId] = useState<
        string | number | undefined
    >();

    const [consumerOptions, setConsumerOptions] = useState<
        Array<{ value: string; label: string }>
    >([]);
    const [selectedConsumers, setSelectedConsumers] = useState<string[]>([]);
    const [isLoadingConsumers, setIsLoadingConsumers] = useState(false);

    // Get selected consumer names for display
    const getSelectedConsumerNames = () => {
        if (selectedConsumers.length === 0) return "";
        const names = selectedConsumers
            .map((consumerNumber) => {
                const option = consumerOptions.find(
                    (opt) => opt.value === consumerNumber
                );
                return option ? option.label : consumerNumber;
            })
            .filter(Boolean);

        // If too many, show count
        if (names.length > 3) {
            return `${names.slice(0, 3).join(", ")} +${names.length - 3} more`;
        }
        return names.join(", ");
    };

    // Create display value for dropdown (shows names instead of just count)
    const consumerDisplayValue =
        selectedConsumers.length > 0 ? getSelectedConsumerNames() : "";

    const tableColumns = [
        { key: "sNo", label: "S.No" },
        { key: "aldCompanyName", label: "Company Name", spacing: "px-0" },
        { key: "companyCode", label: "Company Code", compact: "tight" },
        { key: "aldCompanyCode", label: "Consumer Number", compact: "tight" },
        { key: "unitName", label: "Unit Name" },
        { key: "location", label: "Location" },
        { key: "meterNumber", label: "Meter No", compact: "tight" },
        {
            key: "billMonthYear",
            label: "Bill Period",
            render: (_value: any, row: any) => {
                if (row.billMonth && row.billYear) {
                    const monthName = new Date(
                        row.billYear,
                        row.billMonth - 1
                    ).toLocaleDateString("en-US", {
                        month: "long",
                    });
                    return `${monthName} ${row.billYear}`;
                }
                return "N/A";
            },
        },
        { key: "contractedMD", label: "Contracted MD (kVA)", align: "right" },
        { key: "recordedMD", label: "Recorded MD (kVA)", align: "right" },
        {
            key: "minBillingDemand",
            label: "Min. Billing Demand (kVA)",
            align: "right",
        },
        {
            key: "demandForBilling",
            label: "Demand for Billing (kVA)",
            align: "right",
        },
        {
            key: "openingReadingDate",
            label: "Opening Reading Date",
            align: "center",
        },
        { key: "openingReading", label: "Opening Reading", align: "right" },
        {
            key: "closingReadingDate",
            label: "Closing Reading Date",
            align: "center",
        },
        { key: "closingReading", label: "Closing Reading", align: "right" },
        { key: "consumptionUnits", label: "Consumption Units", align: "right" },
        { key: "unitRate", label: "Unit Rate/Elec Duty (Rs.)", align: "right" },
        {
            key: "demandCharges",
            label: "Demand Charges (Rs.) (A)",
            align: "right",
        },
        {
            key: "demandPenalCharges",
            label: "Demand Penality Charges (Rs.) (B)",
            align: "right",
        },
        {
            key: "energyCharges",
            label: "Energy Charges (Rs.) (C)",
            align: "right",
        },
        { key: "imcCharges", label: "IMC Charges (Rs.) (D)", align: "right" },
        {
            key: "totalCharges",
            label: "Total Charges (Rs.) (A+B+C+D)",
            align: "right",
        },
        // {
        //     key: "tariffType",
        //     label: "Tariff Type",
        //     render: (_value: string, row: any) => (
        //         <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        //             {row.tariffType || "postpaid"}
        //         </span>
        //     ),
        // },
        // {
        //     key: "status",
        //     label: "Status",
        //     render: (value: string) => (
        //         <span
        //             className={`px-2 py-1 rounded-full text-xs font-medium ${
        //                 value === "Paid"
        //                     ? "bg-secondary-light text-secondary"
        //                     : value === "Overdue"
        //                     ? "bg-danger-light text-danger"
        //                     : "bg-warning-light text-warning"
        //             }`}
        //         >
        //             {value}
        //         </span>
        //     ),
        // },
    ];

    const [failedApis, setFailedApis] = useState<
        Array<{
            id: string;
            name: string;
            retryFunction: () => Promise<void>;
            errorMessage: string;
        }>
    >([]);

    const [postpaidStats, setPostpaidStats] = useState<any>(null);
    const [statsLoading, setStatsLoading] = useState(true);

    const formatAmount = (amount: any) => {
        if (!amount || amount === "0" || amount === 0) return "₹0";
        const numAmount =
            typeof amount === "string" ? parseFloat(amount) : amount;
        if (isNaN(numAmount)) return "₹0";
        return `₹${numAmount.toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    };

    const cardData = [
        {
            title: "Total Bill Amount",
            value: formatAmount(postpaidStats?.totalAmount),
            icon: "icons/total-recharge-collection.svg",
            subtitle1: postpaidStats
                ? `Generated for ${postpaidStats.totalBills || 0} Bills`
                : "Generated for 0 Bills",
            subtitle2: postpaidStats
                ? `vs. ${formatAmount(
                      postpaidStats.previousTotalAmount
                  )} Last Month`
                : "vs. ₹0 Last Month",
        },
        {
            title: "Outstanding Amount",
            value: formatAmount(postpaidStats?.outstandingAmount),
            icon: "icons/wallet.svg",
            subtitle1: postpaidStats
                ? `From ${postpaidStats.pendingCount || 0} Pending Bills`
                : "From 0 Pending Bills",
            subtitle2: postpaidStats
                ? `Due in ${postpaidStats.daysUntilDue || 0} days`
                : "Due in 0 days",
        },
        {
            title: "Overdue Amount",
            value: formatAmount(postpaidStats?.overdueAmount),
            icon: "icons/credit-issued.svg",
            subtitle1: postpaidStats
                ? `From ${postpaidStats.overdueCount || 0} Overdue Bills`
                : "From 0 Overdue Bills",
            subtitle2: postpaidStats
                ? `Average ${postpaidStats.averageOverdueDays || 0} days late`
                : "Average 0 days late",
        },
        {
            title: "Total Amount Paid",
            value: formatAmount(postpaidStats?.paidAmount),
            icon: "icons/paid.svg",
            subtitle1: postpaidStats
                ? `From ${postpaidStats.paidBills || 0} Paid Bills`
                : "From 0 Paid Bills",
            subtitle2: postpaidStats
                ? `vs. ${formatAmount(
                      postpaidStats.previousPaidAmount
                  )} Last Month`
                : "vs. ₹0 Last Month",
        },
    ];

    const [tableData, setTableData] = useState(dummyTableData);
    const [filteredData, setFilteredData] = useState(dummyTableData);
    const [isBillsLoading, setIsBillsLoading] = useState(true);

    const handleViewBill = async (bill: any) => {
        try {
            setIsInvoiceLoadingModalOpen(true);
            setPaymentError("");
            const billNumber = bill.billNumber || bill.id || bill.billId;
            if (!billNumber) {
                throw new Error("Bill number not found");
            }

            // Set loading state - use id (which Table component checks first) or fallback to billNumber
            const rowId = bill.id || bill.billId || billNumber;
            setViewLoadingRowId(rowId);

            const apiUrl = `${BACKEND_URL}/billing/invoice?billNumber=${billNumber}`;
            const token = getStoredToken();
            const response = await fetch(apiUrl, {
                headers: { ...(token && { Authorization: `Bearer ${token}` }) },
                credentials: "include",
            });
            if (!response.ok) {
                throw new Error(
                    `Failed to fetch invoice: ${response.status} ${response.statusText}`
                );
            }
            const result = await response.json();
            const invoiceData = result.data || result;
            if (!invoiceData || Object.keys(invoiceData).length === 0) {
                throw new Error("Invoice data is empty or invalid");
            }
            const pdfUrl = await fillPDFForm(invoiceData);
            if (!pdfUrl) {
                throw new Error("Failed to generate PDF URL");
            }
            try {
                const pdfWindow = window.open(pdfUrl, "_blank");
                if (!pdfWindow) {
                    console.warn(
                        " Popup blocked by browser. Trying iframe approach..."
                    );
                    const iframe = document.createElement("iframe");
                    iframe.src = pdfUrl;
                    iframe.style.width = "100%";
                    iframe.style.height = "100vh";
                    iframe.style.position = "fixed";
                    iframe.style.top = "0";
                    iframe.style.left = "0";
                    iframe.style.zIndex = "9999";
                    iframe.style.border = "none";
                    iframe.style.backgroundColor = "white";
                    const closeBtn = document.createElement("button");
                    closeBtn.textContent = "✕ Close";
                    closeBtn.style.position = "fixed";
                    closeBtn.style.top = "10px";
                    closeBtn.style.right = "10px";
                    closeBtn.style.zIndex = "10000";
                    closeBtn.style.padding = "10px 20px";
                    closeBtn.style.backgroundColor = "#333";
                    closeBtn.style.color = "white";
                    closeBtn.style.border = "none";
                    closeBtn.style.borderRadius = "5px";
                    closeBtn.style.cursor = "pointer";
                    closeBtn.onclick = () => {
                        document.body.removeChild(iframe);
                        document.body.removeChild(closeBtn);
                        try {
                            URL.revokeObjectURL(pdfUrl);
                        } catch (e) {
                            console.warn("Error revoking URL:", e);
                        }
                    };
                    document.body.appendChild(iframe);
                    document.body.appendChild(closeBtn);
                    setTimeout(() => {
                        try {
                            const link = document.createElement("a");
                            link.href = pdfUrl;
                            link.download = `invoice_${billNumber}.pdf`;
                            link.style.display = "none";
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                        } catch (err) {
                            console.error("Failed to download PDF:", err);
                        }
                    }, 1000);
                } else {
                    pdfWindow.addEventListener("load", () => {});

                    pdfWindow.addEventListener("error", () => {
                        console.error("❌ PDF window failed to load");
                        const link = document.createElement("a");
                        link.href = pdfUrl;
                        link.download = `invoice_${billNumber}.pdf`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    });

                    setTimeout(() => {
                        try {
                            URL.revokeObjectURL(pdfUrl);
                        } catch (err) {
                            console.warn(" Error revoking blob URL:", err);
                        }
                    }, 300000);
                }
            } catch (windowError) {
                const link = document.createElement("a");
                link.href = pdfUrl;
                link.download = `invoice_${billNumber}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        } catch (err) {
            const errorMsg =
                "Error generating invoice: " +
                (err instanceof Error ? err.message : "Unknown error");
            setPaymentError(errorMsg);

            if (err instanceof Error && err.message.includes("template")) {
                alert(
                    "PDF Template Error: " +
                        err.message +
                        "\n\nPlease ensure Bill_Invoice.pdf is in the src/Invoice/ folder."
                );
            }
        } finally {
            // Clear loading state
            setViewLoadingRowId(undefined);
            setIsInvoiceLoadingModalOpen(false);
        }
    };

    const retrySpecificAPI = (apiId: string) => {
        const api = failedApis.find((a) => a.id === apiId);
        if (api) {
            api.retryFunction();
        }
    };

    const retryStatsAPI = async () => {
        setStatsLoading(true);
        try {
            const params = new URLSearchParams();
            if (selectedDate) {
                let dateToParse = selectedDate;
                if (selectedDate.match(/^\d{4}-\d{2}$/)) {
                    dateToParse = `${selectedDate}-01`;
                }
                const d = new Date(dateToParse);
                if (!isNaN(d.getTime())) {
                    params.set("billMonth", String(d.getMonth() + 1));
                    params.set("billYear", String(d.getFullYear()));
                }
            }
            const url = params.toString()
                ? `${BACKEND_URL}/billing/postpaid/stats?${params.toString()}`
                : `${BACKEND_URL}/billing/postpaid/stats`;
            const token = getStoredToken();
            const res = await fetch(url, {
                headers: { ...(token && { Authorization: `Bearer ${token}` }) },
                credentials: "include",
            });

            if (!res.ok) {
                throw new Error(`Stats API failed with status ${res.status}`);
            }

            const contentType = res.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                throw new Error("Stats API returned non-JSON response");
            }

            const data = await res.json();
            setPostpaidStats(data?.data || null);

            if (data?.data?.amountRanges && data.data.amountRanges.length > 0) {
                setAmountRangeOptions([...data.data.amountRanges]);
            } else {
                setAmountRangeOptions([]);
            }

            setAmountRange("");

            setFailedApis((prev) => prev.filter((api) => api.id !== "stats"));
        } catch (err: any) {
            console.error("Error in Postpaid Stats:", err);
            setPostpaidStats(null);
        } finally {
            setStatsLoading(false);
        }
    };

    const retryBillsAPI = async () => {
        setIsBillsLoading(true);
        try {
            let allBillsData: any[] = [];

            if (dateRange[0] && dateRange[1]) {
                // Date range - fetch all months
                const startDate = new Date(dateRange[0]);
                const endDate = new Date(dateRange[1]);

                if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
                    const monthsToFetch: Array<{
                        month: number;
                        year: number;
                    }> = [];
                    const current = new Date(startDate);
                    const end = new Date(endDate);

                    while (current <= end) {
                        monthsToFetch.push({
                            month: current.getMonth() + 1,
                            year: current.getFullYear(),
                        });
                        current.setMonth(current.getMonth() + 1);
                    }

                    const fetchPromises = monthsToFetch.map(
                        async ({ month, year }) => {
                            const params = new URLSearchParams();
                            params.set("page", "1");
                            params.set("limit", "10000");
                            params.set("billMonth", String(month));
                            params.set("billYear", String(year));

                            const apiUrl = `${BACKEND_URL}/billing/postpaid/table?${params.toString()}`;
                            const token = getStoredToken();
                            const res = await fetch(apiUrl, {
                                headers: { ...(token && { Authorization: `Bearer ${token}` }) },
                                credentials: "include",
                            });

                            if (!res.ok) return [];
                            const data = await res.json();
                            return data?.data?.data || data?.data || [];
                        }
                    );

                    const results = await Promise.all(fetchPromises);
                    allBillsData = results.flat();
                }
            } else if (selectedDate) {
                let dateToParse = selectedDate;
                if (selectedDate.match(/^\d{4}-\d{2}$/)) {
                    dateToParse = `${selectedDate}-01`;
                }
                const d = new Date(dateToParse);
                if (!isNaN(d.getTime())) {
                    const params = new URLSearchParams();
                    params.set("page", "1");
                    params.set("limit", "10000");
                    const month = (d.getMonth() + 1).toString();
                    const year = d.getFullYear().toString();
                    params.set("billMonth", month);
                    params.set("billYear", year);

                    const retryUrl = `${BACKEND_URL}/billing/postpaid/table?${params.toString()}`;
                    const token = getStoredToken();
                    const res = await fetch(retryUrl, {
                        headers: { ...(token && { Authorization: `Bearer ${token}` }) },
                        credentials: "include",
                    });

                    if (!res.ok) {
                        throw new Error(
                            `Bills API failed with status ${res.status}`
                        );
                    }

                    const contentType = res.headers.get("content-type");
                    if (
                        !contentType ||
                        !contentType.includes("application/json")
                    ) {
                        throw new Error("Bills API returned non-JSON response");
                    }
                    const data = await res.json();
                    allBillsData = data?.data?.data || data?.data || [];
                }
            } else {
                // No date filter
                const params = new URLSearchParams();
                params.set("page", "1");
                params.set("limit", "10000");

                const retryUrl = `${BACKEND_URL}/billing/postpaid/table?${params.toString()}`;
                const token = getStoredToken();
                const res = await fetch(retryUrl, {
                    headers: { ...(token && { Authorization: `Bearer ${token}` }) },
                    credentials: "include",
                });

                if (!res.ok) {
                    throw new Error(
                        `Bills API failed with status ${res.status}`
                    );
                }

                const contentType = res.headers.get("content-type");
                if (!contentType || !contentType.includes("application/json")) {
                    throw new Error("Bills API returned non-JSON response");
                }
                const data = await res.json();
                allBillsData = data?.data?.data || data?.data || [];
            }

            // Remove duplicates
            const uniqueBills = Array.from(
                new Map(
                    allBillsData.map((bill: any) => [
                        bill.id || bill.billNumber,
                        bill,
                    ])
                ).values()
            );

            const billsDataWithSNo = uniqueBills.map(
                (bill: any, index: number) => ({
                    ...bill,
                    sNo: index + 1,
                })
            );

            setTableData(billsDataWithSNo);
            setSelectedRows([]);

            setFailedApis((prev) => prev.filter((api) => api.id !== "bills"));
        } catch (err: any) {
            setTableData(dummyTableData);
            setFilteredData(dummyTableData);
        } finally {
            setIsBillsLoading(false);
        }
    };

    // Fetch consumers for dropdown
    useEffect(() => {
        const fetchConsumers = async () => {
            setIsLoadingConsumers(true);
            try {
                // Fetch all consumers with a high limit to get all of them
                const params = new URLSearchParams();
                params.set("page", "1");
                params.set("limit", "10000"); // High limit to get all consumers

                const token = getStoredToken();
                const response = await fetch(
                    `${BACKEND_URL}/consumers?${params.toString()}`,
                    {
                        headers: { ...(token && { Authorization: `Bearer ${token}` }) },
                        credentials: "include",
                    }
                );

                if (!response.ok) {
                    throw new Error("Failed to fetch consumers");
                }

                const result = await response.json();

                if (result.success && result.data) {
                    // Transform consumers data to dropdown options format
                    // The API returns rows from mapConsumersToRows which uses keys with spaces
                    // Use 'Consumer Number' as value since that's what's available in billing data
                    const options = result.data.map((consumer: any) => {
                        // Handle both formats: mapped rows (with spaces) and raw consumer data
                        let consumerNumber =
                            consumer["Consumer Number"] ||
                            consumer.consumerNumber ||
                            consumer.consumerId?.toString() ||
                            consumer.id?.toString() ||
                            "";

                        // Normalize consumer number to string and trim whitespace
                        consumerNumber = String(consumerNumber).trim();

                        const consumerName =
                            consumer["Consumer Name"] ||
                            consumer.name ||
                            consumer.consumerName ||
                            "Unknown Consumer";

                        return {
                            value: consumerNumber,
                            label: consumerName,
                        };
                    });

                    // Filter out any invalid entries and remove duplicates
                    const validOptions = options
                        .filter(
                            (opt: any) =>
                                opt.value && opt.label && opt.value !== "N/A"
                        )
                        .filter(
                            (opt: any, index: number, self: any[]) =>
                                index ===
                                self.findIndex(
                                    (t: any) =>
                                        String(t.value).trim().toLowerCase() ===
                                        String(opt.value).trim().toLowerCase()
                                )
                        );

                    setConsumerOptions(validOptions);
                } else {
                    console.error("Failed to fetch consumers:", result.message);
                    setConsumerOptions([]);
                }
            } catch (error) {
                console.error("Error fetching consumers:", error);
                setConsumerOptions([]);
            } finally {
                setIsLoadingConsumers(false);
            }
        };

        fetchConsumers();
    }, []);

    useEffect(() => {
        const fetchPostpaidStats = async () => {
            setStatsLoading(true);
            try {
                const params = new URLSearchParams();
                if (selectedDate) {
                    const d = new Date(selectedDate);
                    if (!isNaN(d.getTime())) {
                        params.set("billMonth", String(d.getMonth() + 1));
                        params.set("billYear", String(d.getFullYear()));
                    }
                }
                const url = params.toString()
                    ? `${BACKEND_URL}/billing/postpaid/stats?${params.toString()}`
                    : `${BACKEND_URL}/billing/postpaid/stats`;
                const token = getStoredToken();
                const response = await fetch(url, {
                    headers: { ...(token && { Authorization: `Bearer ${token}` }) },
                    credentials: "include",
                });
                if (!response.ok)
                    throw new Error("Failed to fetch postpaid stats");
                const result = await response.json();
                if (!result.success)
                    throw new Error(
                        result.message || "Failed to fetch postpaid stats"
                    );
                setPostpaidStats(result.data);

                if (
                    result.data.amountRanges &&
                    result.data.amountRanges.length > 0
                ) {
                    setAmountRangeOptions([...result.data.amountRanges]);
                } else {
                    setAmountRangeOptions([]);
                }

                setAmountRange("");

                setFailedApis((prev) =>
                    prev.filter((api) => api.id !== "stats")
                );
            } catch (err) {
                console.error(
                    err instanceof Error
                        ? err.message
                        : "Failed to fetch postpaid stats"
                );
                setPostpaidStats(null);
                setFailedApis((prev) => {
                    if (!prev.find((api) => api.id === "stats")) {
                        return [
                            ...prev,
                            {
                                id: "stats",
                                name: "Postpaid Statistics",
                                retryFunction: retryStatsAPI,
                                errorMessage:
                                    "Failed to load Postpaid Statistics. Please try again.",
                            },
                        ];
                    }
                    return prev;
                });
            } finally {
                setStatsLoading(false);
            }
        };

        fetchPostpaidStats();
    }, [selectedDate]);

    useEffect(() => {
        const fetchBills = async () => {
            setIsBillsLoading(true);
            try {
                // For date range, we need to fetch bills for all months in the range
                let allBillsData: any[] = [];

                if (dateRange[0] && dateRange[1]) {
                    // Date range selected - fetch bills for each month in the range
                    const startDate = new Date(dateRange[0]);
                    const endDate = new Date(dateRange[1]);

                    if (
                        !isNaN(startDate.getTime()) &&
                        !isNaN(endDate.getTime())
                    ) {
                        // Generate all months between start and end
                        const monthsToFetch: Array<{
                            month: number;
                            year: number;
                        }> = [];
                        const current = new Date(startDate);
                        const end = new Date(endDate);

                        while (current <= end) {
                            monthsToFetch.push({
                                month: current.getMonth() + 1,
                                year: current.getFullYear(),
                            });
                            // Move to next month
                            current.setMonth(current.getMonth() + 1);
                        }

                        // Fetch bills for each month
                        const fetchPromises = monthsToFetch.map(
                            async ({ month, year }) => {
                                const params = new URLSearchParams();
                                params.set("page", "1");
                                params.set("limit", "10000");
                                params.set("billMonth", String(month));
                                params.set("billYear", String(year));

                                const apiUrl = `${BACKEND_URL}/billing/postpaid/table?${params.toString()}`;
                                const token = getStoredToken();
                                const res = await fetch(apiUrl, {
                                    headers: { ...(token && { Authorization: `Bearer ${token}` }) },
                                    credentials: "include",
                                });

                                if (!res.ok) {
                                    console.warn(
                                        `Failed to fetch bills for ${month}/${year}`
                                    );
                                    return [];
                                }

                                const contentType =
                                    res.headers.get("content-type");
                                if (
                                    !contentType ||
                                    !contentType.includes("application/json")
                                ) {
                                    console.warn(
                                        `Invalid response for ${month}/${year}`
                                    );
                                    return [];
                                }

                                const data = await res.json();
                                return data?.data?.data || data?.data || [];
                            }
                        );

                        const results = await Promise.all(fetchPromises);
                        allBillsData = results.flat();
                    }
                } else if (selectedDate) {
                    // Single date selected
                    const d = new Date(selectedDate);
                    if (!isNaN(d.getTime())) {
                        const params = new URLSearchParams();
                        params.set("page", "1");
                        params.set("limit", "10000");
                        const month = (d.getMonth() + 1).toString();
                        const year = d.getFullYear().toString();
                        params.set("billMonth", month);
                        params.set("billYear", year);

                        const apiUrl = `${BACKEND_URL}/billing/postpaid/table?${params.toString()}`;
                        const token = getStoredToken();
                        const res = await fetch(apiUrl, {
                            headers: { ...(token && { Authorization: `Bearer ${token}` }) },
                            credentials: "include",
                        });

                        if (!res.ok) {
                            throw new Error(
                                `Bills API failed with status ${res.status}`
                            );
                        }

                        const contentType = res.headers.get("content-type");
                        if (
                            !contentType ||
                            !contentType.includes("application/json")
                        ) {
                            throw new Error(
                                "Bills API returned non-JSON response"
                            );
                        }

                        const data = await res.json();
                        allBillsData = data?.data?.data || data?.data || [];
                    }
                } else {
                    // No date filter - fetch latest month or all
                    const params = new URLSearchParams();
                    params.set("page", "1");
                    params.set("limit", "10000");

                    const apiUrl = `${BACKEND_URL}/billing/postpaid/table?${params.toString()}`;
                    const token = getStoredToken();
                    const res = await fetch(apiUrl, {
                        headers: { ...(token && { Authorization: `Bearer ${token}` }) },
                        credentials: "include",
                    });

                    if (!res.ok) {
                        throw new Error(
                            `Bills API failed with status ${res.status}`
                        );
                    }

                    const contentType = res.headers.get("content-type");
                    if (
                        !contentType ||
                        !contentType.includes("application/json")
                    ) {
                        throw new Error("Bills API returned non-JSON response");
                    }

                    const data = await res.json();
                    allBillsData = data?.data?.data || data?.data || [];
                }

                // Remove duplicates based on bill ID
                const uniqueBills = Array.from(
                    new Map(
                        allBillsData.map((bill: any) => [
                            bill.id || bill.billNumber,
                            bill,
                        ])
                    ).values()
                );

                const billsDataWithSNo = uniqueBills.map(
                    (bill: any, index: number) => ({
                        ...bill,
                        sNo: index + 1,
                    })
                );

                setTableData(billsDataWithSNo);
                // Don't set filteredData here - let the filter useEffect handle it
                setSelectedRows([]);

                setFailedApis((prev) =>
                    prev.filter((api) => api.id !== "bills")
                );
            } catch (err: any) {
                console.error("❌ Error in Bills Table:", err);
                console.error("❌ Error Details:", {
                    message: err.message,
                    stack: err.stack,
                    name: err.name,
                });

                setTableData(dummyTableData);
                setFilteredData(dummyTableData);

                setFailedApis((prev) => {
                    if (!prev.find((api) => api.id === "bills")) {
                        return [
                            ...prev,
                            {
                                id: "bills",
                                name: "Bill Data",
                                retryFunction: retryBillsAPI,
                                errorMessage:
                                    "Failed to load Bills Table. Please try again.",
                            },
                        ];
                    }
                    return prev;
                });
            } finally {
                setIsBillsLoading(false);
            }
        };

        fetchBills();
    }, [selectedDate, dateRange]);

    const loadRazorpayScript = () => {
        return new Promise((resolve) => {
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    };

    const handleGenerateBills = async () => {
        try {
            setIsGeneratingBills(true);
            setBillGenerationMessage("");

            const token = getStoredToken();
            const response = await fetch(
                `${BACKEND_URL}/billing/generate-monthly`,
                {
                    credentials: "include",
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...(token && { Authorization: `Bearer ${token}` }),
                    },
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to generate bills: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                setBillGenerationMessage(
                    `Successfully generated ${result.data.generatedBills} bills!`
                );
                window.location.reload();
            } else {
                throw new Error(result.message || "Failed to generate bills");
            }
        } catch (error) {
            console.error("Error generating bills:", error);
            setBillGenerationMessage(
                `❌ Error: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`
            );
        } finally {
            setIsGeneratingBills(false);
        }
    };

    const handlePayBill = async (bill: any) => {
        const testAmount = 1.0;
        try {
            setIsProcessingPayment(true);
            setPaymentError("");

            const res = await loadRazorpayScript();
            if (!res) {
                throw new Error("Razorpay SDK failed to load");
            }

            const token = getStoredToken();
            const orderResponse = await fetch(
                `${BACKEND_URL}/billing/payment/create-link`,
                {
                    credentials: "include",
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...(token && { Authorization: `Bearer ${token}` }),
                    },
                    body: JSON.stringify({
                        billId: bill.id || bill.billId,
                        amount: testAmount,
                    }),
                }
            );

            if (!orderResponse.ok) {
                throw new Error(
                    `Failed to create payment link: ${orderResponse.status}`
                );
            }

            const orderData = await orderResponse.json();

            if (!orderData.success) {
                throw new Error(
                    orderData.message || "Failed to create payment link"
                );
            }

            const { order_id, currency } = orderData.data;

            if (!order_id) {
                throw new Error("Failed to create payment order");
            }

            const options = {
                key: import.meta.env.VITE_RAZORPAY_KEY_ID,
                amount: Math.round(testAmount * 100),
                currency: currency || "INR",
                name: "GMR Energy",
                description: `Test Payment - ${bill.unitName} (₹${testAmount})`,
                order_id: order_id,
                handler: async function (response: any) {
                    try {
                        const verifyToken = getStoredToken();
                        const verifyResponse = await fetch(
                            `${BACKEND_URL}/billing/payment/verify`,
                            {
                                credentials: "include",
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                    ...(verifyToken && { Authorization: `Bearer ${verifyToken}` }),
                                },
                                body: JSON.stringify({
                                    razorpay_payment_id:
                                        response.razorpay_payment_id,
                                    razorpay_order_id:
                                        response.razorpay_order_id,
                                    razorpay_signature:
                                        response.razorpay_signature,
                                    bill_id: bill.id || bill.billId,
                                }),
                            }
                        );

                        const verifyData = await verifyResponse.json();

                        if (verifyData.success) {
                            const isTestPayment =
                                verifyData.data?.is_test_payment;
                            const message = isTestPayment
                                ? `Test Payment successful! Amount: ₹${testAmount}`
                                : `Payment successful! Amount: ₹${testAmount}`;
                            alert(message);

                            setTimeout(() => {
                                retryBillsAPI();
                                retryStatsAPI();
                            }, 1000);
                        } else {
                            throw new Error(
                                verifyData.message ||
                                    "Payment verification failed"
                            );
                        }
                    } catch (error) {
                        console.error("Payment verification error:", error);
                        setPaymentError(
                            "Payment verification failed. Please contact support."
                        );
                    } finally {
                        setIsProcessingPayment(false);
                    }
                },
                prefill: {
                    name: bill.aldCompanyName,
                    email: bill.aldCompanyEmail || "",
                    contact: bill.aldCompanyPhone || "",
                },
                theme: {
                    color: "#3399cc",
                },
                modal: {
                    ondismiss: function () {
                        setIsProcessingPayment(false);
                    },
                },
            };

            const razorpay = new window.Razorpay(options);

            razorpay.on("payment.failed", function (_response: any) {
                setPaymentError("Payment failed. Please try again.");
                setIsProcessingPayment(false);
            });

            razorpay.open();
        } catch (error: any) {
            setPaymentError(
                `Failed to process payment: ${error.message || "Unknown error"}`
            );
            setIsProcessingPayment(false);
        }
    };

    const handleExportToExcel = async () => {
        try {
            // Use filteredData which already has all filters applied (consumers, date range, search, etc.)
            if (!filteredData || filteredData.length === 0) {
                alert(
                    "No data available to export. Please apply filters or ensure data is loaded."
                );
                return;
            }

            const exportData = filteredData.map((row: any, index: number) => ({
                "S.No": index + 1,
                "Company Name": row.aldCompanyName || "N/A",
                "Company Code": row.companyCode || "N/A",
                "Consumer Number": row.aldCompanyCode || "N/A",
                "Unit Name": row.unitName || "N/A",
                Location: row.location || "N/A",
                "Meter No": row.meterNumber || "N/A",
                "Bill Period":
                    row.billMonth && row.billYear
                        ? `${new Date(
                              row.billYear,
                              row.billMonth - 1
                          ).toLocaleDateString("en-US", {
                              month: "long",
                          })} ${row.billYear}`
                        : "N/A",
                "Contracted MD (kVA)": row.contractedMD || "N/A",
                "Recorded MD (kVA)": row.recordedMD || "N/A",
                "Min. Billing Demand (kVA)": row.minBillingDemand || "N/A",
                "Demand for Billing (kVA)": row.demandForBilling || "N/A",
                "Opening Reading Date": row.openingReadingDate || "N/A",
                "Opening Reading": row.openingReading || "N/A",
                "Closing Reading Date": row.closingReadingDate || "N/A",
                "Closing Reading": row.closingReading || "N/A",
                "Consumption Units": row.consumptionUnits || "N/A",
                "Unit Rate/Elec Duty (Rs.)": row.unitRate || "N/A",
                "Demand Charges (Rs.) (A)": row.demandCharges || "N/A",
                "Demand Penality Charges (Rs.) (B)":
                    row.demandPenalCharges || "N/A",
                "Energy Charges (Rs.) (C)": row.energyCharges || "N/A",
                "IMC Charges (Rs.) (D)": row.imcCharges || "N/A",
                "Total Charges (Rs.) (A+B+C+D)": row.totalCharges || "N/A",
            }));

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(exportData);

            const colWidths = [
                { wch: 8 }, // S.No
                { wch: 20 }, // Company Name
                { wch: 15 }, // Consumer Number
                { wch: 15 }, // Company Code
                { wch: 20 }, // Location
                { wch: 15 }, // Unit Name
                { wch: 15 }, // Meter No
                { wch: 18 }, // Bill Period
                { wch: 18 }, // Contracted MD (kVA)
                { wch: 18 }, // Recorded MD (kVA)
                { wch: 20 }, // Min. Billing Demand (kVA)
                { wch: 20 }, // Demand for Billing (kVA)
                { wch: 20 }, // Opening Reading Date
                { wch: 15 }, // Opening Reading
                { wch: 20 }, // Closing Reading Date
                { wch: 15 }, // Closing Reading
                { wch: 18 }, // Consumption Units
                { wch: 25 }, // Unit Rate/Elec Duty (Rs.)
                { wch: 20 }, // Demand Charges (Rs.) (A)
                { wch: 25 }, // Demand Penality Charges (Rs.) (B)
                { wch: 20 }, // Energy Charges (Rs.) (C)
                { wch: 20 }, // IMC Charges (Rs.) (D)
                { wch: 30 }, // Total Charges (Rs.) (A+B+C+D)
            ];
            ws["!cols"] = colWidths;

            XLSX.utils.book_append_sheet(wb, ws, "Postpaid Bills");

            const currentDate = new Date().toISOString().split("T")[0];
            const filename = `Postpaid_Bills_${currentDate}.xlsx`;
            XLSX.writeFile(wb, filename);
        } catch (error) {
            console.error("Error exporting to Excel:", error);
            alert("Failed to export data. Please try again.");
        }
    };

    const handleFilterChange = (itemId: string) => {
        if (itemId === "bulkStatus") {
            setIsBulkStatusModalOpen(true);
        } else if (
            itemId === "paid" ||
            itemId === "unpaid" ||
            itemId === "overdue"
        ) {
            setPaymentStatus(itemId);
        } else if (itemId === "high-amount") {
            setAmountRange("5000+");
        } else if (itemId === "low-amount") {
            setAmountRange("0-1000");
        } else if (itemId === "all") {
            setPaymentStatus("");
            setAmountRange("");
            setSelectedDate("");
            setDateRange(["", ""]);
            setSearch("");
            setSelectedConsumers([]);
        }
    };

    const handleApplyBulkStatus = async (formData: any) => {
        try {
            const selectedStatus =
                formData.paymentStatus || bulkStatusSelection;
            const dateValue = formData.selectedDate || selectedDate;

            if (!selectedStatus) {
                alert("Please select a status to update");
                return;
            }

            if (!dateValue) {
                alert("Please select a month to apply bulk status");
                return;
            }

            const d = new Date(dateValue);
            const billMonth = d.getMonth() + 1;
            const billYear = d.getFullYear();

            const confirmed = window.confirm(
                `Apply status '${selectedStatus}' to all bills of ${d.toLocaleDateString(
                    "en-US",
                    {
                        month: "long",
                        year: "numeric",
                    }
                )}?`
            );
            if (!confirmed) return;

            const token = getStoredToken();
            const response = await fetch(
                `${BACKEND_URL}/billing/update-status-by-month`,
                {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                        ...(token && { Authorization: `Bearer ${token}` }),
                    },
                    body: JSON.stringify({
                        billMonth,
                        billYear,
                        status: selectedStatus,
                    }),
                }
            );

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(
                    err?.message || `Failed with status ${response.status}`
                );
            }

            const result = await response.json();
            alert(
                `Updated ${
                    result.updatedCount || 0
                } bill(s) to '${selectedStatus}'.`
            );

            retryBillsAPI();
            retryStatsAPI();
        } catch (error: any) {
            console.error("Bulk status update failed:", error);
            alert(
                `Bulk status update failed: ${
                    error?.message || "Unknown error"
                }`
            );
        } finally {
            setIsBulkStatusModalOpen(false);
            setBulkStatusSelection("");
        }
    };

    const handleCloseBulkModal = () => {
        setIsBulkStatusModalOpen(false);
        setBulkStatusSelection("");
    };

    const handlePaymentStatusChange = (
        e: React.ChangeEvent<HTMLSelectElement>
    ) => {
        setPaymentStatus(e.target.value);
    };

    const handleDateRangeChange = (
        value: string | string[] | React.ChangeEvent<HTMLInputElement>
    ) => {
        if (Array.isArray(value)) {
            // Date range selected
            setDateRange([value[0] || "", value[1] || ""]);
            // Clear single date selection
            setSelectedDate("");
        } else if (typeof value === "string") {
            // Single date selected
            if (value.match(/^\d{4}-\d{2}$/)) {
                setSelectedDate(`${value}-01`);
            } else {
                setSelectedDate(value);
            }
            // Clear date range
            setDateRange(["", ""]);
        } else {
            // React.ChangeEvent
            const dateValue = value.target.value;
            if (dateValue && dateValue.match(/^\d{4}-\d{2}$/)) {
                setSelectedDate(`${dateValue}-01`);
            } else {
                setSelectedDate(dateValue);
            }
            setDateRange(["", ""]);
        }
    };

    const handleSelectionChange = (selectedIds: string[]) => {
        setSelectedRows(selectedIds);
    };

    // Handle consumer dropdown change - memoized to prevent re-renders
    const handleConsumerChange = useCallback(
        (value: string | string[] | any) => {
            // Handle different value types from the dropdown component
            let newValue: string[] = [];

            // Check for React event-like object with target.value
            if (value && typeof value === "object" && value.target) {
                // React event object: { target: { name: 'consumers', value: [...] } }
                if (Array.isArray(value.target.value)) {
                    newValue = value.target.value;
                } else if (value.target.value) {
                    newValue = [value.target.value];
                }
            } else if (Array.isArray(value)) {
                // Already an array - use directly
                newValue = value;
            } else if (value && typeof value === "string") {
                // Single string value - convert to array
                newValue = [value];
            } else if (value && typeof value === "object" && value.value) {
                // Object with value property
                if (Array.isArray(value.value)) {
                    newValue = value.value;
                } else {
                    newValue = [value.value];
                }
            }

            // Validate that all selected values exist in options (normalize for comparison)
            const validOptions = consumerOptions.map((opt) =>
                String(opt.value).trim().toLowerCase()
            );
            const validatedValue = newValue.filter((val) => {
                const normalizedVal = String(val).trim().toLowerCase();
                return validOptions.includes(normalizedVal);
            });

            setSelectedConsumers(validatedValue);
        },
        [consumerOptions]
    );

    const statusOptions = [
        { value: "", label: "Select Status" },
        { value: "paid", label: "Paid" },
        { value: "unpaid", label: "Unpaid" },
    ];

    const handleStatusSubmit = async (
        selectedIds: string[],
        status: string
    ) => {
        if (selectedIds.length === 0) {
            alert("Please select at least one bill to update status");
            return;
        }

        if (!status) {
            alert("Please select a status to update");
            return;
        }

        console.log(
            "Updating status for selected bills:",
            selectedIds,
            "to status:",
            status
        );

        const confirmed = window.confirm(
            `Are you sure you want to update ${selectedIds.length} bill(s) to ${status}?`
        );

        if (confirmed) {
            try {
                const token = getStoredToken();
                const response = await fetch(
                    `${BACKEND_URL}/billing/update-status`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            ...(token && { Authorization: `Bearer ${token}` }),
                        },
                        credentials: "include",
                        body: JSON.stringify({ ids: selectedIds, status }),
                    }
                );

                if (!response.ok) {
                    throw new Error("Failed to update status");
                }

                const result = await response.json();

                alert(
                    `Successfully updated ${result.updatedCount} bill(s) to ${status}!`
                );

                setSelectedRows([]);
                retryBillsAPI();
            } catch (error) {
                console.error("Error updating status:", error);
                alert("Failed to update status. Please try again.");
            }
        }
    };

    useEffect(() => {
        let filtered = [...tableData];

        if (search) {
            filtered = filtered.filter(
                (item) =>
                    (item.aldCompanyName || "")
                        .toLowerCase()
                        .includes(search.toLowerCase()) ||
                    (item.aldCompanyCode || "")
                        .toLowerCase()
                        .includes(search.toLowerCase()) ||
                    (item.location || "")
                        .toLowerCase()
                        .includes(search.toLowerCase()) ||
                    (item.unitName || "")
                        .toLowerCase()
                        .includes(search.toLowerCase()) ||
                    (item.contractedMD || "")
                        .toLowerCase()
                        .includes(search.toLowerCase()) ||
                    (item.recordedMD || "")
                        .toLowerCase()
                        .includes(search.toLowerCase()) ||
                    (item.minBillingDemand || "")
                        .toLowerCase()
                        .includes(search.toLowerCase()) ||
                    (item.demandForBilling || "")
                        .toLowerCase()
                        .includes(search.toLowerCase()) ||
                    (item.openingReadingDate || "")
                        .toLowerCase()
                        .includes(search.toLowerCase()) ||
                    (item.openingReading || "")
                        .toLowerCase()
                        .includes(search.toLowerCase()) ||
                    (item.closingReadingDate || "")
                        .toLowerCase()
                        .includes(search.toLowerCase()) ||
                    (item.closingReading || "")
                        .toLowerCase()
                        .includes(search.toLowerCase()) ||
                    (item.consumptionUnits || "")
                        .toLowerCase()
                        .includes(search.toLowerCase()) ||
                    (item.unitRate || "")
                        .toLowerCase()
                        .includes(search.toLowerCase()) ||
                    (item.demandCharges || "")
                        .toLowerCase()
                        .includes(search.toLowerCase()) ||
                    (item.demandPenalCharges || "")
                        .toLowerCase()
                        .includes(search.toLowerCase()) ||
                    (item.energyCharges || "")
                        .toLowerCase()
                        .includes(search.toLowerCase()) ||
                    (item.imcCharges || "")
                        .toLowerCase()
                        .includes(search.toLowerCase()) ||
                    (item.totalCharges || "")
                        .toLowerCase()
                        .includes(search.toLowerCase())
            );
        }

        if (amountRange) {
            const selectedRange = amountRangeOptions.find(
                (opt) => opt.value === amountRange
            );
            if (
                selectedRange &&
                selectedRange.min !== undefined &&
                selectedRange.max !== undefined
            ) {
                filtered = filtered.filter((item) => {
                    const totalAmount = parseFloat(item.totalCharges) || 0;
                    return (
                        totalAmount >= selectedRange.min! &&
                        totalAmount <= selectedRange.max!
                    );
                });
            }
        }

        if (paymentStatus) {
            filtered = filtered.filter((item) => {
                const status = item.status.toLowerCase();
                switch (paymentStatus) {
                    case "paid":
                        return status === "paid";
                    case "unpaid":
                        return status === "unpaid";
                    case "overdue":
                        return status === "overdue";
                    default:
                        return true;
                }
            });
        }

        // Filter by date range or selected date
        if (dateRange[0] && dateRange[1]) {
            // Date range filtering
            try {
                const startDate = new Date(dateRange[0]);
                const endDate = new Date(dateRange[1]);

                // Set end date to end of month for proper range comparison
                const endOfMonth = new Date(
                    endDate.getFullYear(),
                    endDate.getMonth() + 1,
                    0
                );

                if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
                    filtered = filtered.filter((item) => {
                        if (item.billMonth && item.billYear) {
                            const billDate = new Date(
                                item.billYear,
                                item.billMonth - 1,
                                1
                            );
                            return (
                                billDate >= startDate && billDate <= endOfMonth
                            );
                        }

                        if (
                            item.billingPeriod &&
                            item.billingPeriod !== "N/A"
                        ) {
                            const [month, year] = item.billingPeriod.split("/");
                            const billDate = new Date(
                                parseInt(year),
                                parseInt(month) - 1,
                                1
                            );
                            return (
                                billDate >= startDate && billDate <= endOfMonth
                            );
                        }

                        return false;
                    });
                }
            } catch (error) {
                console.error("Error parsing date range:", error);
            }
        } else if (selectedDate) {
            // Single date filtering
            try {
                let dateToParse = selectedDate;
                if (selectedDate.match(/^\d{4}-\d{2}$/)) {
                    dateToParse = `${selectedDate}-01`;
                }

                const selectedDateObj = new Date(dateToParse);

                if (isNaN(selectedDateObj.getTime())) {
                    console.warn("Invalid date selected:", selectedDate);
                } else {
                    const selectedYear = selectedDateObj.getFullYear();
                    const selectedMonth = selectedDateObj.getMonth() + 1;

                    filtered = filtered.filter((item) => {
                        if (item.billMonth && item.billYear) {
                            return (
                                item.billMonth === selectedMonth &&
                                item.billYear === selectedYear
                            );
                        }

                        if (
                            item.billingPeriod &&
                            item.billingPeriod !== "N/A"
                        ) {
                            const [month, year] = item.billingPeriod.split("/");
                            return (
                                parseInt(month) === selectedMonth &&
                                parseInt(year) === selectedYear
                            );
                        }

                        if (
                            item.openingReadingDate &&
                            item.openingReadingDate !== "N/A"
                        ) {
                            try {
                                const openingDate = new Date(
                                    item.openingReadingDate
                                );
                                return (
                                    openingDate.getFullYear() ===
                                        selectedYear &&
                                    openingDate.getMonth() + 1 === selectedMonth
                                );
                            } catch (error) {
                                return false;
                            }
                        }

                        return false;
                    });
                }
            } catch (error) {
                console.error("Error parsing selected date:", error);
            }
        }

        // Filter by selected consumers - ONLY show bills for selected consumers
        // If consumers are selected, filter to show ONLY those consumers' bills
        // If no consumers selected, show all bills
        if (selectedConsumers.length > 0) {
            // Normalize selected consumer numbers for comparison
            const normalizedSelected = selectedConsumers.map((selected) =>
                String(selected).trim().toLowerCase()
            );

            filtered = filtered.filter((item: any) => {
                // Check if the bill's consumer number matches any selected consumer
                // Try multiple fields that might contain consumer number
                // aldCompanyCode is the consumer number in the table data (from billing API)
                let consumerNumber =
                    item.consumerNumber ||
                    item.aldCompanyCode ||
                    item.consumer?.consumerNumber ||
                    "";

                // Skip if consumer number is "N/A" or empty
                if (!consumerNumber || consumerNumber === "N/A") {
                    return false;
                }

                // Convert to string and normalize for comparison (case-insensitive)
                const consumerNumberStr = String(consumerNumber)
                    .trim()
                    .toLowerCase();

                // Check if this consumer number matches any selected consumer
                const isMatch = normalizedSelected.includes(consumerNumberStr);

                return isMatch;
            });
        }

        setFilteredData(filtered);

        if (selectedRows.length > 0) {
            setSelectedRows([]);
        }
    }, [
        tableData,
        search,
        amountRange,
        paymentStatus,
        selectedDate,
        dateRange,
        amountRangeOptions,
        selectedConsumers,
    ]);

    return (
        <Suspense fallback={<div>Loading...</div>}>
            <Page
                sections={[
                    {
                        layout: {
                            type: "column",
                            gap: "gap-4",
                            rows: [
                                {
                                    layout: "column",
                                    columns: [
                                        ...(failedApis.length > 0
                                            ? [
                                                  {
                                                      name: "Error",
                                                      props: {
                                                          visibleErrors:
                                                              failedApis.map(
                                                                  (api) =>
                                                                      api.errorMessage
                                                              ),
                                                          showRetry: true,
                                                          maxVisibleErrors: 3,
                                                          failedApis:
                                                              failedApis,
                                                          onRetrySpecific:
                                                              retrySpecificAPI,
                                                      },
                                                  },
                                              ]
                                            : []),
                                        ...(paymentError
                                            ? [
                                                  {
                                                      name: "Error",
                                                      props: {
                                                          visibleErrors: [
                                                              paymentError,
                                                          ],
                                                          showRetry: false,
                                                          maxVisibleErrors: 1,
                                                          onClose: () =>
                                                              setPaymentError(
                                                                  ""
                                                              ),
                                                      },
                                                  },
                                              ]
                                            : []),
                                        ...(billGenerationMessage
                                            ? [
                                                  {
                                                      name: "Success",
                                                      props: {
                                                          visibleErrors: [
                                                              billGenerationMessage,
                                                          ],
                                                          showRetry: false,
                                                          maxVisibleErrors: 1,
                                                          onClose: () =>
                                                              setBillGenerationMessage(
                                                                  ""
                                                              ),
                                                      },
                                                  },
                                              ]
                                            : []),
                                        {
                                            name: "PageHeader",
                                            props: {
                                                title: "Bills Postpaid",
                                                onBackClick: () =>
                                                    navigate("/dashboard"),
                                                backButtonText:
                                                    "Back to Dashboard",
                                                buttonsLabel: "Export",
                                                variant: "primary",
                                                onClick: handleExportToExcel,
                                                showMenu: true,
                                                showDropdown: true,
                                                menuItems: [
                                                    {
                                                        id: "generate",
                                                        label: isGeneratingBills
                                                            ? "Generating..."
                                                            : "Generate Bills",
                                                        onClick:
                                                            handleGenerateBills,
                                                        disabled:
                                                            isGeneratingBills,
                                                    },
                                                    {
                                                        id: "bulkStatus",
                                                        label: "Bulk Status",
                                                    },
                                                ],
                                                onMenuItemClick:
                                                    handleFilterChange,
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    },
                    {
                        layout: {
                            type: "column",
                            gap: "gap-4",
                            rows: [
                                {
                                    layout: "grid",
                                    gridColumns: 4,
                                    gap: "gap-4",
                                    columns: cardData
                                        .slice(0, 4)
                                        .map((card) => ({
                                            name: "Card",
                                            props: {
                                                ...card,
                                                bg: "bg-stat-icon-gradient",
                                                loading: statsLoading,
                                            },
                                        })),
                                },
                            ],
                        },
                    },

                    {
                        layout: {
                            type: "column",
                            gap: "gap-4",
                            rows: [
                                {
                                    layout: "row",
                                    className:
                                        "flex flex-col md:flex-row md:items-center md:gap-4 gap-4",
                                    columns: [
                                        {
                                            name: "Dropdown",
                                            props: {
                                                name: "consumers",
                                                value: selectedConsumers,
                                                displayValue:
                                                    consumerDisplayValue, // Show selected consumer names
                                                placeholder: isLoadingConsumers
                                                    ? "Loading consumers..."
                                                    : consumerOptions.length ===
                                                      0
                                                    ? "No consumers available"
                                                    : selectedConsumers.length ===
                                                      0
                                                    ? "Select Consumers"
                                                    : `${
                                                          selectedConsumers.length
                                                      } consumer${
                                                          selectedConsumers.length >
                                                          1
                                                              ? "s"
                                                              : ""
                                                      } selected`,
                                                onChange: handleConsumerChange,
                                                options:
                                                    consumerOptions.length > 0
                                                        ? consumerOptions
                                                        : [
                                                              {
                                                                  value: "",
                                                                  label: "No consumers available",
                                                              },
                                                          ],
                                                className: "w-full md:w-1/3",
                                                searchable: true,
                                                isMultiSelect: true,
                                                disabled:
                                                    isLoadingConsumers ||
                                                    consumerOptions.length ===
                                                        0,
                                            },
                                        },
                                        {
                                            name: "RangePicker",
                                            props: {
                                                value:
                                                    dateRange[0] && dateRange[1]
                                                        ? dateRange
                                                        : selectedDate
                                                        ? [
                                                              selectedDate,
                                                              selectedDate,
                                                          ]
                                                        : ["", ""],
                                                onChange: handleDateRangeChange,
                                                placeholder:
                                                    "Filter by Date Range",
                                                className: "w-full md:w-1/3",
                                                selectionMode: "range",
                                                picker: "month",
                                            },
                                        },
                                        {
                                            name: "Dropdown",
                                            props: {
                                                name: "paymentStatus",
                                                value: paymentStatus,
                                                onChange:
                                                    handlePaymentStatusChange,
                                                options:
                                                    filterPaymentStatusOptions,
                                                className: "w-full md:w-1/3",
                                                searchable: false,
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    },

                    {
                        layout: {
                            type: "column",
                            gap: "gap-4",
                            rows: [
                                {
                                    layout: "grid",
                                    gridColumns: 1,
                                    className: "pb-4",
                                    columns: [
                                        {
                                            name: "Table",
                                            props: {
                                                data: filteredData,
                                                columns: tableColumns,
                                                minColumnWidth: 120,
                                                searchable: true,
                                                selectable: true,
                                                showFilterButton: true,
                                                onFilterApply: (
                                                    selectedIds: string[]
                                                ) => {
                                                    setAppliedFilters(
                                                        selectedIds
                                                    );
                                                },
                                                appliedFilters: appliedFilters,
                                                selectedRows: selectedRows,
                                                onSelectionChange:
                                                    handleSelectionChange,
                                                statusOptions: statusOptions,
                                                onStatusSubmit:
                                                    handleStatusSubmit,
                                                statusDropdownPlaceholder:
                                                    "Select Status for Bulk Update",
                                                pagination: true,
                                                rowsPerPageOptions: [
                                                    5, 10, 15, 25, 50,
                                                ],

                                                search: true,
                                                initialRowsPerPage: 10,
                                                itemsPerPage: 10,
                                                showPagination: true,
                                                pageSize: 10,
                                                emptyMessage:
                                                    search ||
                                                    amountRange ||
                                                    paymentStatus ||
                                                    selectedDate ||
                                                    (dateRange[0] &&
                                                        dateRange[1]) ||
                                                    selectedConsumers.length > 0
                                                        ? "No bills found matching your filters"
                                                        : "No Bills Found",
                                                showHeader: true,
                                                headerTitle: `Consumption period${
                                                    dateRange[0] && dateRange[1]
                                                        ? ` - ${new Date(
                                                              dateRange[0]
                                                          ).toLocaleDateString(
                                                              "en-US",
                                                              {
                                                                  month: "long",
                                                                  year: "numeric",
                                                              }
                                                          )} to ${new Date(
                                                              dateRange[1]
                                                          ).toLocaleDateString(
                                                              "en-US",
                                                              {
                                                                  month: "long",
                                                                  year: "numeric",
                                                              }
                                                          )}`
                                                        : selectedDate
                                                        ? ` - ${new Date(
                                                              selectedDate
                                                          ).toLocaleDateString(
                                                              "en-US",
                                                              {
                                                                  month: "long",
                                                                  year: "numeric",
                                                              }
                                                          )}`
                                                        : ""
                                                }${
                                                    selectedConsumers.length > 0
                                                        ? ` (${
                                                              selectedConsumers.length
                                                          } consumer${
                                                              selectedConsumers.length >
                                                              1
                                                                  ? "s"
                                                                  : ""
                                                          } selected)`
                                                        : ""
                                                }`,
                                                isLoading: isBillsLoading,
                                                className: "w-full",
                                                onPayment: handlePayBill,
                                                onView: handleViewBill,
                                                showActions: true,
                                                showDownload: true,
                                                downloadFileName:
                                                    "postpaid-bills",
                                                enableHorizontalScroll: true,
                                                viewLoadingRowId:
                                                    viewLoadingRowId,
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    },
                    {
                        layout: {
                            type: "column",
                            gap: "gap-0",
                            rows: [
                                {
                                    layout: "row",
                                    columns: [
                                        {
                                            name: "Modal",
                                            props: {
                                                isOpen: isBulkStatusModalOpen,
                                                onClose: handleCloseBulkModal,
                                                title: "Bulk Status Update",
                                                transparent: true,
                                                size: "sm",
                                                showCloseIcon: true,
                                                backdropClosable: true,
                                                centered: true,
                                                showForm: true,

                                                formFields: [
                                                    {
                                                        type: "dropdown" as const,
                                                        label: "Payment Status",
                                                        name: "paymentStatus",
                                                        searchable: false,
                                                        value: bulkStatusSelection,
                                                        required: true,
                                                        options:
                                                            bulkPaymentStatusOptions,
                                                        onChange: (
                                                            value: string
                                                        ) =>
                                                            setBulkStatusSelection(
                                                                value
                                                            ),
                                                    },
                                                    {
                                                        type: "calendar" as const,
                                                        label: "Filter by Month",
                                                        name: "selectedDate",
                                                        placeholder:
                                                            "Select billing period",
                                                        selectionMode: "month",
                                                        value: selectedDate,
                                                        required: false,
                                                        onChange: (
                                                            value: string
                                                        ) =>
                                                            setSelectedDate(
                                                                value
                                                            ),
                                                    },
                                                ],
                                                onSave: handleApplyBulkStatus,
                                                saveButtonLabel: "Submit",
                                                cancelButtonLabel: "Cancel",
                                                gridLayout: {
                                                    gridRows: 1,
                                                    gridColumns: 1,
                                                    gap: "gap-4",
                                                },
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    },
                    // Commented out Modal spinner - using Spinner component with showAsModal instead
                    // {
                    //     layout: {
                    //         type: "column",
                    //         gap: "gap-0",
                    //         rows: [
                    //             {
                    //                 layout: "row",
                    //                 columns: [
                    //                     {
                    //                         name: "Modal",
                    //                         props: {
                    //                             isOpen: isInvoiceLoadingModalOpen,
                    //                             onClose:
                    //                                 handleCloseInvoiceLoadingModal,
                    //                             size: "sm",
                    //                             showCloseIcon: false,
                    //                             backdropClosable: false,
                    //                             centered: true,
                    //                             showHeader: false,
                    //                             showForm: true,
                    //                             showPageC: true,
                    //                             bodyClassName:'flex justify-center',
                    //                             pageCSections: [
                    //                                 {
                    //                                     layout: {
                    //                                         type: "column",
                    //                                         gap: "gap-4",
                    //                                     },
                    //                                     components: [
                    //                                         {
                    //                                             name: "Spinner",
                    //                                             props: {
                    //                                                 loading:
                    //                                                     true,
                    //                                             },
                    //                                         },
                    //                                     ],
                    //                                 },
                    //                             ],
                    //                             gridLayout: {
                    //                                 gridRows: 1,
                    //                                 gridColumns: 1,
                    //                                 gap: "gap-4",
                    //                             },
                    //                         },
                    //                     },
                    //                 ],
                    //             },
                    //         ],
                    //     },
                    // },
                    // Conditionally render Spinner only when loading invoice
                    ...(isInvoiceLoadingModalOpen
                        ? [
                              {
                                  layout: {
                                      type: "column",
                                      gap: "gap-0",
                                      rows: [
                                          {
                                              layout: "row",
                                              columns: [
                                                  {
                                                      name: "Spinner",
                                                      props: {
                                                          showAsModal: true,
                                                          size: "lg",
                                                      },
                                                  },
                                              ],
                                          },
                                      ],
                                  },
                              },
                          ]
                        : []),
                ]}
            />
        </Suspense>
    );
}