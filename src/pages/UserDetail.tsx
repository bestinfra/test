import { lazy } from 'react';
import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
const Page = lazy(() => import('SuperAdmin/Page'));

const UserDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const [user, setUser] = useState<any>(null);
    const [_loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState('basic-info');
    
    // State for sidebar items
    const [sidebarItems, setSidebarItems] = useState([
        {
            id: 'basic-info',
            label: 'Basic Information',
            isActive: false,
        },
        {
            id: 'change-password',
            label: 'Change Password',
            isActive: false,
        },
        {
            id: 'activities',
            label: 'Activities',
            isActive: false,
        },
        {
            id: 'notifications',
            label: 'Notifications',
            isActive: false,
        },
        {
            id: 'two-step-verification',
            label: 'Two-step Verification',
            isActive: false,
        },
        {
            id: 'account-status',
            label: 'Account Status',
            isActive: false,
        },
    ]);

    // Update sidebar items when activeSection changes
    useEffect(() => {
        setSidebarItems(prevItems => 
            prevItems.map(item => ({
                ...item,
                isActive: item.id === activeSection
            }))
        );
    }, [activeSection]);

    // Get user data from navigation state or fetch from API
    useEffect(() => {
        
        // First check if user data is passed through navigation state
        if (location.state?.user) {
            setUser(location.state.user);
            setLoading(false);
        } else if (id) {
            // If no state data, fetch user data by ID
            setLoading(true);
            // Simulate API call - replace with actual API call 
            setTimeout(() => {
                // Mock user data based on ID
                const mockUser = {
                    sNo: parseInt(id),
                    name: `User ${id}`,
                    email: `user${id}@example.com`,
                    phone: `+1-555-0${id.padStart(3, '0')}`,
                    role: 'User',
                    client: 'Demo Corp',
                    createdDate: '2024-01-01',
                    status: 'Active',
                    lastLogin: '2025-01-20 10:30:00',
                    department: 'IT',
                    permissions: ['read', 'write']
                };
                setUser(mockUser);
                setLoading(false);
            }, 500);
        } else {
            setLoading(false);
        }
    }, [id, location.state]);

    const handleMenuItemClick = (itemId: string) => {
        switch (itemId) {
            case 'edit':
           
                navigate(`/edit-user/${user?.sNo || id}`, {
                    state: { user }
                });
                break;
            case 'delete':
                break;
            case 'suspend':
            
                break;
            default:
        }
    };

    const handleBackClick = () => {
        navigate('/users');
    };

    const handleRefreshClick = () => {
        setLoading(true);
        // Refresh user data
        setTimeout(() => {
            setLoading(false);
        }, 500);
    };

    const handleSidebarItemClick = (itemId: string) => {
        setActiveSection(itemId);
    };

    const menuItems = [
        {
            id: 'edit',
            label: 'Edit User',
        },
        {
            id: 'suspend',
            label: 'Suspend User',
        },
        {
            id: 'delete',
            label: 'Delete User',
            isDestructive: true,
        },
    ];

    // Map the user data to the format expected by BasicInformationTab
    const basicInfoData = user ? {
        name: user.name,
        email: user.email,
        phone: user.phone,
        role_title: user.role,
        client_name: user.client,
        last_active: user.lastLogin,
        created_at: user.createdDate,
        USER_ID: user.sNo?.toString(),
        id: user.sNo
    } : undefined;

    return (
        <Suspense fallback={<div>Loading...</div>}>
            <Page
                sections={[
                    {
                        layout: {
                            type: 'column',
                            gap: 'gap-4',
                        },
                        components: [
                            {
                                name: 'PageHeader',
                                props: {
                                    title: 'User Details',
                                    menuItems: menuItems,
                                    onMenuItemClick: handleMenuItemClick,
                                    variant: 'primary',
                                    onClick: () => handleMenuItemClick('edit'),
                                    onBackClick: handleBackClick,
                                    backButtonText: 'Back to Users',
                                    onRightImageClick: handleRefreshClick,
                                    status: user?.status || 'Active',
                                    // Remove any dynamic props that might cause header updates
                                    editMode: false,
                                    unitName: undefined,
                                },
                            },
                        ],
                    },
                    {
                        layout: {
                            type: 'grid',
                            gridRows: 1,
                            columns: 5,
                            gap: 'gap-6',
                            className: 'w-full h-full' 
                        },
                        components: [
                            {
                                name: 'ProfileSidebar',
                                props: {
                                    items: sidebarItems,
                                    onItemClick: handleSidebarItemClick,
                                },
                                span:{
                                    col:1,
                                    row:1
                                }
                            },
                            {
                                name: 'ProfileContent',
                                props: {
                                    section: activeSection,
                                    data: {
                                        basicInfo: basicInfoData
                                    },
                                    className: 'flex-1'
                                },
                                span:{col:4,row:1}
                            }
                        ],
                    },
                ]}
                sectionWrapperClassName=""
            />
        </Suspense>
    );
};

export default UserDetail;
        