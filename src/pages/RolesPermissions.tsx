import { lazy } from 'react';
import { useState, useEffect, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
const Page = lazy(() => import('SuperAdmin/Page'));

interface Role {
    id: number;
    name: string;
    roleName?: string;
    users: Array<{
        id: number;
        username: string;
        firstName: string;
        lastName: string;
        email: string;
        isActive: boolean;
    }>;
    permissions: Array<{ id: number; name: string; description: string }>;
    createdAt: string;
    updatedAt?: string;
}

export default function RolesPermissions() {
    const navigate = useNavigate();
    const location = useLocation();
    const role = location.state?.role;
    
    const [currentRole, setCurrentRole] = useState<Role | null>(role || null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!role) {
            // If no role is passed, redirect back to role management
            navigate('/role-management');
            return;
        }
        setCurrentRole(role);
    }, [role, navigate]);

    const handleBackClick = () => {
        navigate('/role-management');
    };

    const handlePermissionsSave = async (_permissions: string[]) => {
        try {
            setLoading(true);
            
            // Here you would make the actual API call to save permissions
            // const response = await fetch(`${BACKEND_URL}/roles/${currentRole?.id}/permissions`, {
            //     method: 'PUT',
            //     headers: {
            //         'Content-Type': 'application/json'
            //     },
            //     body: JSON.stringify({
            //         permissions: permissions
            //     })
            // });
            
            // if (response.ok) {
            //     // Success - could show a success message
            // } else {
            //     throw new Error('Failed to save permissions');
            // }
            
            // For demo purposes, just log the permissions
            
            // Navigate back to role management after successful save
            navigate('/role-management');
        } catch (error) {
            console.error('Error saving permissions:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!currentRole) {
        return null;
    }

    return (
        <Suspense fallback={<div>Loading...</div>}>
            <Page
                sections={[
                    // Page Header Section
                    {
                        layout: {
                            type: 'column',
                            gap: 'gap-4',
                            rows: [
                                {
                                    layout: 'row',
                                    columns: [
                                        {
                                            name: 'PageHeader',
                                            props: {
                                                title: `Permissions for ${currentRole.name || currentRole.roleName}`,
                                                onBackClick: handleBackClick,
                                                backButtonText: 'Back to Role Management',
                                                showMenu: false,
                                                showDropdown: false,
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    },
                    // Permissions Content Section
                    {
                        layout: {
                            type: 'column' as const,
                            gap: 'gap-4',
                            rows: [
                                {
                                    layout: 'row' as const,
                                    columns: [
                                        {
                                            name: 'Permissions',
                                            props: {
                                                role: currentRole,
                                                onSave: handlePermissionsSave,
                                                onBackClick: handleBackClick,
                                                loading: loading,
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    },
                ]}
            />
        </Suspense>
    );
} 