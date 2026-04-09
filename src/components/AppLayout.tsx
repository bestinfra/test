import React, { lazy, useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiClient } from "../api/apiUtils";
import BACKEND_URL from "../config";
import { AUTH_CONFIG } from "../config/auth";
const Header = lazy(() => import("SuperAdmin/Header"));
const Sidebar = lazy(() => import("SuperAdmin/Sidebar"));
interface AppLayoutProps {
    children: React.ReactNode;
    apiBaseUrl?: string;
}
function AppLayout({ children, apiBaseUrl }: AppLayoutProps) {
    const location = useLocation();
    const navigate = useNavigate();
    // Resolve API base URL: prop -> env -> BACKEND_URL from config
    const baseApiUrl = apiBaseUrl ?? BACKEND_URL;
    const [notifications, setNotifications] = useState<any[]>([]);
    const [tariffData, setTariffData] = useState<any>(null);
    const [tariffLoading, setTariffLoading] = useState(false);
    const [tariffError, setTariffError] = useState<string | null>(null);
    // Simplified page title mapping
    const pageTitles: Record<string, string> = {
    '/consumer-dashboard': 'Consumer Dashboard',
    '/individual-detail': 'Individual Detail',
    '/consumers': 'Consumer Management',
    '/consumers/:consumerId': 'Consumer Detail View',
    '/asset-management': 'Asset Management',
    '/users': 'Users',
    '/users/:userId': 'User Detail',
    '/add-user': 'Add User',
    '/role-management': 'Role Management',
    '/roles-permissions': 'Roles Permissions',
    '/tickets': 'Tickets',
    '/tickets/:ticketId': 'Ticket View',
    '/add-ticket': 'Add Ticket',
    '/bills/prepaid': 'Prepaid Bills',
    '/': 'Consumer Dashboard'
    };
    // Menu configuration - filtered by selected modules
    const menuItems = [
    { title: 'Consumer Dashboard', icon: '/icons/dashboard.svg', link: '/' },
    { title: 'Consumer Management', icon: '/icons/customer-service.svg', link: '/consumers' },
    { title: 'Assets', icon: '/icons/workflow-setting-alt.svg', link: '/asset-management' },
    {
      title: 'User Management',
      icon: '/icons/user.svg',
      hasSubmenu: true,
      submenu: [
,
        {
          title: 'Users',
          link: '/users',
        },
,
        {
          title: 'User Detail',
          link: '/users/:userId',
        },
,
        {
          title: 'Add User',
          link: '/add-user',
        },
,
        {
          title: 'Role Management',
          link: '/role-management',
        },
,
        {
          title: 'Roles Permissions',
          link: '/roles-permissions',
        },
,
      ],
    },
,
    { title: 'Users', icon: '/icons/user.svg', link: '/users' },
    { title: 'Role Management', icon: '/icons/roles.svg', link: '/role-management' },
    { title: 'All Tickets', icon: '/icons/customer-service.svg', link: '/tickets' },
    { title: 'Prepaid Bills', icon: '/icons/bills.svg', link: '/bills/prepaid' }
    ];
    // Tariff functions
    const fetchTariffData = async () => {
        try {
            setTariffLoading(true);
            setTariffError(null);
            const response = await apiClient.get("/dashboard/tariff");
            if (response && Array.isArray(response) && response.length > 0) {
                // Set all tariffs data
                setTariffData(response);
                return response;
            } else if (
                response &&
                Array.isArray(response) &&
                response.length === 0
            ) {
                // No tariff data found, but API call was successful
                setTariffData(null);
                return null;
            } else {
                throw new Error("Invalid response format from tariff API");
            }
        } catch (error: any) {
            const errorMessage =
                error.response?.data?.message ||
                error.message ||
                "Failed to fetch tariff data";
            setTariffError(errorMessage);
            throw error;
        } finally {
            setTariffLoading(false);
        }
    };
    const refreshTariffData = async () => {
        try {
            await fetchTariffData();
        } catch (error) {}
    };
    const handleTariffDataError = (error: any) => {
        setTariffError(error.message || "Tariff data error");
    };
    // Search suggestions handler - for autocomplete dropdown as user types
    const handleSearchSuggestions = async (query: string) => {
        if (!query || query.length < 2) {
            return [];
        }
        try {
            const trimmedQuery = query.trim();
            const fullUrl = `${baseApiUrl}/consumers/search?query=${encodeURIComponent(
                trimmedQuery
            )}`;
            console.log("🔍 [SEARCH] Making API call to:", fullUrl);
            const response = await fetch(fullUrl, {
                credentials: "include",
                headers: { "Content-Type": "application/json" },
            });
            if (response.ok) {
                const result = await response.json();
                console.log("🔍 [SEARCH] API Response:", result);
                if (result.success && result.data && result.data.length > 0) {
                    // Transform to match what the Input component expects for display
                    // Since Input component prioritizes consumerNumber for highlighting, we'll swap values
                    const suggestions = result.data.map(
                        (item: any, index: number) => {
                            const suggestion = {
                                id: `consumer-${index}`,
                                // WORKAROUND: Swap values so consumer name appears highlighted
                                consumerNumber: item.name || "Unknown", // Put consumer name here so it gets highlighted
                                name: `${item.consumerNumber || "N/A"} • ${
                                    item.meterNumber || "N/A"
                                }`, // Put consumer number + meter in name
                                meter: item.meterNumber || "No Meter",
                                uid: item.uid || item.consumerNumber,
                                // Keep original values for navigation
                                originalConsumerNumber: item.consumerNumber,
                                originalName: item.name,
                                originalMeterNumber: item.meterNumber,
                                // Store original data for navigation
                                _originalData: item,
                                _searchType: "consumer",
                            };
                            console.log(
                                "🔍 [SEARCH] Transformed suggestion (with swap):",
                                suggestion
                            );
                            return suggestion;
                        }
                    );
                    console.log(
                        "🔍 [SEARCH] Returning suggestions:",
                        suggestions
                    );
                    return suggestions;
                }
            }
            console.log("🔍 [SEARCH] No results found");
            return [];
        } catch (error) {
            console.error("🔍 [SEARCH] Error:", error);
            return [];
        }
    };
    // Search result click handler - when user clicks a suggestion
    const handleSearchResultClick = (result: any) => {
        console.log("Search result clicked:", result);
        // Navigate using original values (not the swapped values)
        const consumerNumber =
            result.originalConsumerNumber ||
            result._originalData?.consumerNumber;
        const uid = result._originalData?.uid;
        if (consumerNumber) {
            navigate(`/consumers/${consumerNumber}`);
        } else if (uid) {
            navigate(`/consumers/${uid}`);
        }
    };
    // Global search handler - when user presses Enter without selecting a suggestion
    const handleGlobalSearch = async (query: string) => {
        if (!query || query.length < 2) {
            return;
        }
        try {
            const trimmedQuery = query.trim();
            const fullUrl = `${baseApiUrl}/consumers/search?query=${encodeURIComponent(
                trimmedQuery
            )}`;
            const response = await fetch(fullUrl, {
                credentials: "include",
                headers: { "Content-Type": "application/json" },
            });
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data && result.data.length > 0) {
                    const firstResult = result.data[0];
                    // Navigate to first result
                    if (firstResult.consumerNumber) {
                        navigate(`/consumers/${firstResult.consumerNumber}`);
                        return;
                    } else if (firstResult.uid) {
                        navigate(`/consumers/${firstResult.uid}`);
                        return;
                    }
                }
            }
            // No results
            alert(
                `No results found for "${trimmedQuery}". Please check your search term.`
            );
        } catch (error) {
            console.error("Search error:", error);
            alert(`Search failed. Please try again.`);
        }
    };
    const fetchNotifications = async () => {
        try {
            const response = await apiClient.get("/notifications");
            if (!response.data || !response.data.notifications) {
                return getDummyNotifications();
            }
            const dbNotifications = response.data.notifications;
            const transformedNotifications = dbNotifications.map(
                (notification: any) => ({
                    ...notification,
                    created_at: notification.created_at
                        ? new Date(notification.created_at).toISOString()
                        : new Date().toISOString(),
                })
            );
            setNotifications(transformedNotifications);
            return transformedNotifications;
        } catch (error) {
            // Return dummy data as fallback
            return getDummyNotifications();
        }
    };
    const markNotificationAsRead = async (notificationId: string) => {
        try {
            console.log(
                `📋 [FRONTEND] Marking notification ${notificationId} as read`
            );
            const response = await apiClient.put(
                `/notifications/${notificationId}/read`,
                {}
            );
            console.log(`📋 [FRONTEND] Mark as read response:`, response);
            // Update local state immediately for better UX
            setNotifications((prev) =>
                prev.map((notif) =>
                    notif.id === notificationId
                        ? { ...notif, is_read: true, isUnread: false }
                        : notif
                )
            );
            // Fetch fresh notifications from server to ensure consistency
            await fetchNotifications();
            console.log(
                `📋 [FRONTEND] Notification ${notificationId} marked as read successfully`
            );
        } catch (error) {
            console.error(
                `📋 [FRONTEND] Error marking notification as read:`,
                error
            );
            // Refetch notifications on error to restore correct state
            await fetchNotifications();
        }
    };
    const markAllNotificationsAsRead = async () => {
        try {
            console.log(`📋 [FRONTEND] Marking all notifications as read`);
            await apiClient.put("/notifications/mark-all-read", {});
            // Update local state immediately for better UX
            setNotifications((prev) =>
                prev.map((notif) => ({
                    ...notif,
                    is_read: true,
                    isUnread: false,
                }))
            );
            // Fetch fresh notifications from server to ensure consistency
            await fetchNotifications();
            console.log(
                `📋 [FRONTEND] All notifications marked as read successfully`
            );
        } catch (error) {
            console.error(
                `📋 [FRONTEND] Error marking all notifications as read:`,
                error
            );
            // Refetch notifications on error to restore correct state
            await fetchNotifications();
        }
    };
    // Dummy notifications fallback
    function getDummyNotifications() {
        return [
            {
                id: "1",
                type: "success",
                label: "Welcome",
                title: "Welcome!",
                dateTime: new Date().toLocaleString(),
                isUnread: true,
                isNew: true,
                redirectUrl: "/dashboard",
                message: "Thanks for joining our platform.",
                category: "System",
            },
            {
                id: "2",
                type: "success",
                label: "Update",
                title: "Update Available",
                dateTime: new Date().toLocaleString(),
                isUnread: false,
                isNew: false,
                redirectUrl: "/updates",
                message: "Version 2.0 is now live.",
                category: "System",
            },
        ];
    }
    // Fetch notifications and tariff data on component mount
    useEffect(() => {
        fetchNotifications();
        fetchTariffData();
    }, []);
    // Update notifications when data changes
    useEffect(() => {
        // Store notifications globally so Header can access them
        (window as any).globalNotifications = notifications;
        (window as any).globalNotificationCount = notifications.length;
        // Dispatch custom event to notify Header about notification changes
        const event = new CustomEvent("notificationsUpdated", {
            detail: { notifications, count: notifications.length },
        });
        window.dispatchEvent(event);
    }, [notifications]);
    // Create a function that returns the current notifications state as a Promise
    const getCurrentNotifications = useCallback(async () => {
        // Return the current notifications immediately
        if (notifications.length > 0) {
            return notifications;
        }
        // If no notifications, try to fetch them
        try {
            const freshNotifications = await fetchNotifications();
            return freshNotifications;
        } catch (error) {
            // Return dummy data as fallback
            return getDummyNotifications();
        }
    }, [notifications]); // This dependency will cause the function to change when notifications change
    // Create a function that returns the current tariff data as a Promise
    const getCurrentTariffData = useCallback(async () => {
        // Return the current tariff data immediately if available
        if (tariffData) {
            return tariffData;
        }
        // If no tariff data, try to fetch it
        try {
            const freshTariffData = await fetchTariffData();
            return freshTariffData;
        } catch (error) {
            // Return null as fallback
            return null;
        }
    }, [tariffData]);
    // Expose transformed notifications for Header
    useEffect(() => {
        // Transform notifications to match Header's expected format
        const transformedNotifications = notifications.map(
            (notification: any) => {
                return {
                    id: notification.id.toString(),
                    type:
                        notification.type === "METER_ABNORMALITY"
                            ? "warning"
                            : notification.type === "BILLING"
                            ? "info"
                            : notification.type === "TICKET"
                            ? "ticket"
                            : notification.type === "SYSTEM"
                            ? "success"
                            : "info",
                    label:
                        notification.type === "METER_ABNORMALITY"
                            ? "Meter Alert"
                            : notification.type === "BILLING"
                            ? "Billing"
                            : notification.type === "TICKET"
                            ? "Support"
                            : notification.type === "SYSTEM"
                            ? "System"
                            : "Notification",
                    title: notification.title,
                    dateTime: notification.created_at
                        ? new Date(notification.created_at).toLocaleString()
                        : new Date().toLocaleString(),
                    isUnread: !notification.is_read,
                    isNew:
                        !notification.is_read &&
                        isRecent(notification.created_at),
                    redirectUrl: notification.redirect_url || "/dashboard",
                    message: notification.message,
                    category:
                        notification.type === "METER_ABNORMALITY"
                            ? "Meter"
                            : notification.type === "BILLING"
                            ? "Billing"
                            : notification.type === "TICKET"
                            ? "Support"
                            : notification.type === "SYSTEM"
                            ? "System"
                            : "General",
                };
            }
        );
        // Store transformed notifications globally
        (window as any).headerTransformedNotifications =
            transformedNotifications;
        // Dispatch event to Header with transformed notifications
        const event = new CustomEvent("setNotifications", {
            detail: { notifications: transformedNotifications },
        });
        window.dispatchEvent(event);
    }, [notifications]);
    // Helper function for isRecent
    function isRecent(createdAt: string): boolean {
        const notificationDate = new Date(createdAt);
        const now = new Date();
        const diffInHours =
            (now.getTime() - notificationDate.getTime()) / (1000 * 60 * 60);
        return diffInHours < 24;
    }
    // Update tariff data when it changes
    useEffect(() => {
        // Store tariff data globally so Header can access it
        (window as any).globalTariffData = tariffData;
        (window as any).globalTariffLoading = tariffLoading;
        (window as any).globalTariffError = tariffError;
        // Dispatch custom event to notify Header about tariff data changes
        const event = new CustomEvent("tariffDataUpdated", {
            detail: {
                tariffData,
                loading: tariffLoading,
                error: tariffError,
            },
        });
        window.dispatchEvent(event);
    }, [tariffData, tariffLoading, tariffError]);
    // Generate appId from projectFolderName or use default
    const appId = "tgpdcl-consumer".replace(/[^a-z0-9_]/gi, '_').toLowerCase() || 'subapp';
    return (
        <div className="flex h-screen bg-white dark:bg-primary">
            {/* Sidebar */}
            <Sidebar
                currentPath={location.pathname}
                onNavigate={(path: string) => navigate(path)}
                menus={[{ category: "GENERAL", items: menuItems }]}
                logo={{
                    src: "/images/bi-blue-logo.svg",
                    alt: "TGPDCL Consumer",
                    collapsedSrc: "/images/changed-logo.svg",
                }}
                clientLogo={{
                    src: "/images/clientLogo.svg",
                    alt: "TGNPDCL Client",
                    collapsedSrc: "/images/clientLogo.svg",
                    // title: "Client Information",
                    width:160,
                    className:'bg-none p-0',
                    height: 160,
                }}
                showAppDownload={false}
                footer={{
                    copyright: "© " + new Date().getFullYear() + " TGNPDCL",
                    showThemeToggle: false,
                    showShareButton: false,
                }}
                enableSubAppThemeBridge={true}
                tokenName={AUTH_CONFIG.TOKEN_KEY}
                appId={appId}
            />
            <div className="flex flex-col flex-1">
                {/* Header with Notifications */}
                <Header
                    key={`header-${notifications.length}-${
                        tariffData?.length || 0
                    }-tariffs`}
                    appId={appId}
                    searchPlaceholder="Search consumers by UID, Consumer Number,"
                    title={pageTitles[location.pathname] || "Dashboard"}
                    apiBaseUrl={baseApiUrl}
                    onSearch={handleGlobalSearch}
                    onSearchSuggestions={handleSearchSuggestions}
                    onSearchResultClick={handleSearchResultClick}
                    onFetchNotifications={getCurrentNotifications}
                    showNotifications={false}
                    showNotificationBell={false}
                    onMarkNotificationAsRead={markNotificationAsRead}
                    onMarkAllNotificationsAsRead={markAllNotificationsAsRead}
                    onFetchTariffData={getCurrentTariffData}
                    onTariffDataError={handleTariffDataError}
                    onRefreshTariffData={refreshTariffData}
                    logoutRoute="/tgpdcl-consumer/login"
                    showProfileSettings={true}
                    showLogout={true}
                    clientLogo={{
                        src: "/images/clientLogo.svg",
                        alt: "TGNPDCL Client",
                        // title: "Client Information",
                    }}
                    clientStatus="active"
                    clientName="TGNPDCL"
                    clientType="Client"
                    // clientName="Client"
                />
                {/* Main Content */}
                <main className="flex-1 p-6 bg-white dark:bg-primary-dark overflow-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
export default AppLayout;