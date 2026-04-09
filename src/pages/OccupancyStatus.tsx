import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import PageC from "SuperAdmin/Page";
import BACKEND_URL from "../config";
import { getStoredToken } from "@/config/auth";

// Declare Razorpay types
declare global {
    interface Window {
        Razorpay: any;
    }
}

interface OccupancyStatusProps {
    HeaderTest?: React.ComponentType<any>;
}

interface Step {
    id: number;
    label: string;
    isActive: boolean;
    isCompleted: boolean;
}

// Data interfaces for each step
interface OccupancyData {
    unit_id?: string;
    meter_no?: string;
    consumer_name?: string;
    property_address?: string;
    previous_reading?: string;
    previous_reading_date?: string;
    final_reading?: string;
    final_reading_date?: string;
    electricity_usage?: string;
    electricity_charges?: string;
    final_amount?: string;
    bill_date?: string;
    bill_id?: string;
    payment_method?: string;
    completion_date?: string;
}

const OccupancyStatus: React.FC<OccupancyStatusProps> = ({}) => {
    const [currentStep, setCurrentStep] = useState(1); // Start at step 1 (Confirmation) as shown in image
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { meterNumber } = useParams<{
        meterNumber?: string;
    }>();
    const [searchParams] = useSearchParams();
    const consumerNumberFromUrl = searchParams.get("consumerNumber") || "";
    const [consumerNumberFromApi, setConsumerNumberFromApi] =
        useState<string>("");
    const consumerNumber = consumerNumberFromUrl || consumerNumberFromApi;
    // Enhanced API state management (same pattern as other pages)
    const [failedApis, setFailedApis] = useState<
        Array<{
            id: string;
            name: string;
            retryFunction: () => Promise<void>;
            errorMessage: string;
        }>
    >([]);

    // Centralized data management for all steps
    const [occupancyData, setOccupancyData] = useState<OccupancyData>({
        unit_id: "0",
        meter_no: "0",
        consumer_name: "0",
        property_address: "0",
        previous_reading: "0",
        previous_reading_date: "0",
        final_reading: "0",
        final_reading_date: "0",
        electricity_usage: "0",
        electricity_charges: "0",
        final_amount: "0",
        bill_date: "0",
        bill_id: "0",
        payment_method: "0",
        completion_date: "0",
    });

    // Payment related states (similar to Postpaid.tsx)
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    const [paymentError, setPaymentError] = useState("");

    const steps: Step[] = [
        {
            id: 1,
            label: "Confirmation",
            isActive: currentStep === 1,
            isCompleted: currentStep > 1,
        },
        {
            id: 2,
            label: "Usage-Summary",
            isActive: currentStep === 2,
            isCompleted: currentStep > 2,
        },
        {
            id: 3,
            label: "Payment",
            isActive: currentStep === 3,
            isCompleted: currentStep > 3,
        },
        {
            id: 4,
            label: "Freeze-Status",
            isActive: currentStep === 4,
            isCompleted: currentStep > 4,
        },
    ];

    const handleStepClick = (stepId: number) => {
        setCurrentStep(stepId);
    };

    const handleDarkModeToggle = () => {
        // Handle dark mode toggle
    };

    const handleClose = () => {
        // Navigate back to the consumer detail page using the consumerNumber
        if (consumerNumber) {
            navigate(`/consumer-detail-view/${consumerNumber}`);
        } else {
            // Fallback to dashboard if no consumerNumber is available
            navigate("/dashboard");
        }
    };

    const handleLogoClick = () => {
        // Navigate to dashboard or home page
        navigate("/dashboard");
    };

    // Add function to load Razorpay script
    const loadRazorpayScript = () => {
        return new Promise((resolve) => {
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    };

    // Razorpay payment handler (similar to Postpaid.tsx)
    const handlePayNow = async (_amount: string) => {
        // Fixed amount for testing - ₹10.00 (Razorpay minimum)
        const testAmount = 1.0;
        const amountInPaise = Math.round(testAmount * 100);

        try {
            setIsProcessingPayment(true);
            setPaymentError("");

            // Load Razorpay script
            const res = await loadRazorpayScript();
            if (!res) {
                throw new Error("Razorpay SDK failed to load");
            }

            // Create payment order on your backend
            const token = getStoredToken();
            const orderResponse = await fetch(
                `${BACKEND_URL}/consumers/occupancy/create-order`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...(token && { Authorization: `Bearer ${token}` }),
                    },
                    credentials: "include",
                    body: JSON.stringify({
                        meterNumber: meterNumber,
                        amount: amountInPaise, // Convert to paise (₹10.00 = 1000 paise)
                    }),
                }
            );

            if (!orderResponse.ok) {
                // const errorText = await orderResponse.text();
                // Removed console.error here
                throw new Error(
                    `Failed to create payment order: ${orderResponse.status}`
                );
            }

            const orderData = await orderResponse.json();

            if (!orderData.success) {
                // Removed console.error here
                throw new Error(
                    orderData.message || "Failed to create payment order"
                );
            }

            const { orderId, currency } = orderData;

            if (!orderId) {
                throw new Error("Failed to create payment order");
            }

            // Initialize Razorpay
            const options = {
                key: import.meta.env.VITE_RAZORPAY_KEY_ID,
                amount: amountInPaise, // Convert to paise - using test amount
                currency: currency || "INR",
                name: "GMR Energy",
                description: `Occupancy Payment - ${occupancyData.consumer_name} (₹${testAmount})`,
                order_id: orderId,
                handler: async function (response: any) {
                    try {
                        // Verify payment on backend
                        const verifyToken = getStoredToken();
                        const verifyResponse = await fetch(
                            `${BACKEND_URL}/consumers/occupancy/verify-payment`,
                            {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                    ...(verifyToken && { Authorization: `Bearer ${verifyToken}` }),
                                },
                                credentials: "include",
                                body: JSON.stringify({
                                    razorpay_payment_id:
                                        response.razorpay_payment_id,
                                    razorpay_order_id:
                                        response.razorpay_order_id,
                                    razorpay_signature:
                                        response.razorpay_signature,
                                    amount: amountInPaise,
                                    meterNumber: meterNumber,
                                }),
                            }
                        );

                        const verifyData = await verifyResponse.json();

                        if (verifyData.success) {
                            // Show success message
                            const message = `Occupancy Payment successful! Amount: ₹${testAmount}`;
                            alert(message);

                            // Move to next step
                            setCurrentStep(4);
                        } else {
                            throw new Error(
                                verifyData.message ||
                                    "Payment verification failed"
                            );
                        }
                    } catch (error) {
                        // Removed console.error here
                        setPaymentError(
                            "Payment verification failed. Please contact support."
                        );
                    } finally {
                        setIsProcessingPayment(false);
                    }
                },
                prefill: {
                    name: occupancyData.consumer_name || "Consumer",
                    email: "consumer@example.com",
                    contact: "9999999999",
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

    // Retry specific API function
    const retrySpecificAPI = (apiId: string) => {
        const api = failedApis.find((a) => a.id === apiId);
        if (api) {
            api.retryFunction();
        }
    };

    // Update occupancy data
    const updateOccupancyData = (newData: Partial<OccupancyData>) => {
        setOccupancyData((prev) => {
            const updated = { ...prev, ...newData };
            return updated;
        });
    };

    // Fetch occupancy data from API
    const fetchOccupancyData = async () => {
        if (!meterNumber) {
            setFailedApis([
                {
                    id: "meterNumber",
                    name: "Meter Number",
                    retryFunction: fetchOccupancyData,
                    errorMessage:
                        "No meter number provided. Please navigate from a consumer detail page.",
                },
            ]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setFailedApis([]);

        try {
            // Fetch confirmation data (Step 1) - include meter number
            const token = getStoredToken();
            const confirmationResponse = await fetch(
                `${BACKEND_URL}/consumers/occupancy/confirmation?meterNumber=${meterNumber}`,
                {
                    headers: { ...(token && { Authorization: `Bearer ${token}` }) },
                    credentials: "include",
                }
            );
            if (!confirmationResponse.ok) {
                throw new Error(
                    `HTTP error! status: ${confirmationResponse.status}`
                );
            }
            const confirmationResult = await confirmationResponse.json();
            if (!confirmationResult.success) {
                throw new Error(
                    confirmationResult.message ||
                        "Failed to fetch confirmation data"
                );
            }

            // Fetch usage summary data (Step 2) - include meter number
            const usageResponse = await fetch(
                `${BACKEND_URL}/consumers/occupancy/usage-summary?meterNumber=${meterNumber}`,
                {
                    headers: { ...(token && { Authorization: `Bearer ${token}` }) },
                    credentials: "include",
                }
            );
            if (!usageResponse.ok) {
                throw new Error(`HTTP error! status: ${usageResponse.status}`);
            }
            const usageResult = await usageResponse.json();
            if (!usageResult.success) {
                throw new Error(
                    usageResult.message || "Failed to fetch usage summary data"
                );
            }

            // Fetch payment data (Step 3) - include meter number and usage summary data
            const usageSummaryForPayment = encodeURIComponent(
                JSON.stringify(usageResult.data)
            );
            const paymentResponse = await fetch(
                `${BACKEND_URL}/consumers/occupancy/payment?meterNumber=${meterNumber}&usageSummaryData=${usageSummaryForPayment}`,
                {
                    headers: { ...(token && { Authorization: `Bearer ${token}` }) },
                    credentials: "include",
                }
            );
            if (!paymentResponse.ok) {
                throw new Error(
                    `HTTP error! status: ${paymentResponse.status}`
                );
            }
            const paymentResult = await paymentResponse.json();
            if (!paymentResult.success) {
                throw new Error(
                    paymentResult.message || "Failed to fetch payment data"
                );
            }

            // Fetch freeze status data (Step 4) - include meter number
            const freezeResponse = await fetch(
                `${BACKEND_URL}/consumers/occupancy/freeze-status?meterNumber=${meterNumber}`,
                {
                    headers: { ...(token && { Authorization: `Bearer ${token}` }) },
                    credentials: "include",
                }
            );
            if (!freezeResponse.ok) {
                throw new Error(`HTTP error! status: ${freezeResponse.status}`);
            }
            const freezeResult = await freezeResponse.json();
            if (!freezeResult.success) {
                throw new Error(
                    freezeResult.message || "Failed to fetch freeze status data"
                );
            }

            // Combine all data
            const combinedData = {
                ...confirmationResult.data,
                ...usageResult.data,
                ...paymentResult.data,
                ...freezeResult.data,
            };

            setOccupancyData(combinedData);

            // Extract consumer number from API response as fallback
            if (!consumerNumberFromUrl) {
                const consumerNum =
                    combinedData.consumer_number ||
                    combinedData.consumerNumber ||
                    combinedData.consumer_no ||
                    combinedData.consumerNo ||
                    combinedData.consumer_id ||
                    combinedData.consumerId;

                if (consumerNum) {
                    setConsumerNumberFromApi(consumerNum);
                }
            }
        } catch (err: any) {
            setOccupancyData({
                unit_id: "0",
                meter_no: "0",
                consumer_name: "0",
                property_address: "0",
                previous_reading: "0",
                previous_reading_date: "0",
                final_reading: "0",
                final_reading_date: "0",
                electricity_usage: "0",
                electricity_charges: "0",
                final_amount: "0",
                bill_date: "0",
                bill_id: "0",
                payment_method: "0",
                completion_date: "0",
            });

            // Add to failed APIs
            setFailedApis([
                {
                    id: "confirmation",
                    name: "Confirmation Data",
                    retryFunction: fetchOccupancyData,
                    errorMessage:
                        "Failed to load Confirmation Data. Please try again.",
                },
                {
                    id: "usageSummary",
                    name: "Usage Summary Data",
                    retryFunction: fetchOccupancyData,
                    errorMessage:
                        "Failed to load Usage Summary Data. Please try again.",
                },
                {
                    id: "payment",
                    name: "Payment Data",
                    retryFunction: fetchOccupancyData,
                    errorMessage:
                        "Failed to load Payment Data. Please try again.",
                },
                {
                    id: "freezeStatus",
                    name: "Freeze Status Data",
                    retryFunction: fetchOccupancyData,
                    errorMessage:
                        "Failed to load Freeze Status Data. Please try again.",
                },
            ]);
        } finally {
            setLoading(false);
        }
    };

    // Initial loading state with timeout
    useEffect(() => {
        const timer = setTimeout(() => {
            setLoading(false);
        }, 3000); // 3 seconds initial loading

        return () => clearTimeout(timer);
    }, []);

    // Debug logging for parameters on component mount
    useEffect(() => {
        // All console logs removed here
    }, [meterNumber, consumerNumber, searchParams]);

    // Fetch data on component mount and when meterNumber changes
    useEffect(() => {
        if (meterNumber) {
            fetchOccupancyData();
        }
    }, [meterNumber]);

    // Get the component name and props based on current step
    const getStepComponentConfig = () => {
        switch (currentStep) {
            case 1:
                return {
                    name: "ConfirmationPage",
                    props: {
                        currentStep: currentStep,
                        onStepChange: setCurrentStep,
                        unit_id: occupancyData.unit_id,
                        meter_no: meterNumber || occupancyData.meter_no,
                        consumer_name: occupancyData.consumer_name,
                        property_address: occupancyData.property_address,
                        className: "w-full h-full",
                    },
                };
            case 2:
                return {
                    name: "UsageSummaryPage",
                    props: {
                        currentStep: currentStep,
                        onStepChange: setCurrentStep,
                        meter_no: meterNumber || occupancyData.meter_no,
                        unit_id: occupancyData.unit_id,
                        previous_reading: occupancyData.previous_reading,
                        previous_reading_date:
                            occupancyData.previous_reading_date,
                        final_reading: occupancyData.final_reading,
                        final_reading_date: occupancyData.final_reading_date,
                        electricity_usage: occupancyData.electricity_usage,
                        electricity_charges: occupancyData.electricity_charges,

                        onDataUpdate: updateOccupancyData,
                        className: "w-full h-full",
                    },
                };
            case 3:
                return {
                    name: "Payment",
                    props: {
                        currentStep: currentStep,
                        onStepChange: setCurrentStep,
                        paymentAmount: occupancyData.final_amount || "10",
                        billId: occupancyData.bill_id || "N/A",
                        billDate: occupancyData.bill_date || "N/A",
                        onPayNow: handlePayNow,
                        isProcessingPayment: isProcessingPayment,
                        paymentError: paymentError,
                        className: "w-full h-full",
                    },
                };
            case 4:
                return {
                    name: "FreezeStatus",
                    props: {
                        currentStep: currentStep,
                        onStepChange: setCurrentStep,
                        completionDate: occupancyData.completion_date,
                        electricity_usage: occupancyData.electricity_usage,
                        final_reading: occupancyData.final_reading,
                        final_amount: occupancyData.final_amount,
                        payment_method: occupancyData.payment_method,
                        onDone: () => {
                            // Navigate to dashboard or show success message
                        },
                        className: "w-full h-full",
                    },
                };
            default:
                return {
                    name: "ConfirmationPage",
                    props: {
                        currentStep: currentStep,
                        onStepChange: setCurrentStep,
                        className: "w-full h-full",
                    },
                };
        }
    };

    const stepConfig = getStepComponentConfig();

    return (
        <div className="h-full ">
            <PageC
                sections={[
                    {
                        layout: {
                            type: "column",
                            className: " h-100vh",
                            gap: "gap-1",
                            rows: [
                                {
                                    layout: "row" as const,
                                    columns: [
                                        {
                                            name: "OccupancyHeader",
                                            props: {
                                                logo: "images/bi-logo-latest.svg", // Pass icon path
                                                onLogoClick: handleLogoClick,
                                                steps: steps,
                                                currentStep: currentStep,
                                                onStepClick: handleStepClick,
                                                onDarkModeToggle:
                                                    handleDarkModeToggle,
                                                onClose: handleClose,
                                                className:
                                                    "border-b border-gray-200",
                                                loading: loading,
                                            },
                                        },
                                    ],
                                },
                                // Error Section (show when there are failed APIs) - Between header and step component
                                ...(failedApis.length > 0
                                    ? [
                                          {
                                              layout: "column" as const,
                                              className: "px-4 py-2",
                                              columns: [
                                                  {
                                                      name: "Error",
                                                      props: {
                                                          visibleErrors:
                                                              failedApis.map(
                                                                  (api) =>
                                                                      api.errorMessage
                                                              ),
                                                          showRetry: true,
                                                          maxVisibleErrors: 3, // Show max 3 errors at once
                                                          failedApis:
                                                              failedApis, // Pass all failed APIs for individual retry
                                                          onRetrySpecific:
                                                              retrySpecificAPI, // Pass the retry function
                                                      },
                                                  },
                                              ],
                                          },
                                      ]
                                    : []),
                                // Show payment error if any
                                ...(paymentError
                                    ? [
                                          {
                                              layout: "column" as const,
                                              className: "px-4 py-2",
                                              columns: [
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
                                              ],
                                          },
                                      ]
                                    : []),
                                {
                                    layout: "column" as const,
                                    className: "flex-1",
                                    gap: "gap-4",
                                    columns: [
                                        {
                                            name: stepConfig.name,
                                            props: {
                                                ...stepConfig.props,
                                                loading: loading,
                                                failedApis: failedApis,
                                                onRetrySpecific:
                                                    retrySpecificAPI,
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    },
                ]}
            />
        </div>
    );
};

export default OccupancyStatus;
