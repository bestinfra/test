import { lazy } from 'react';
import { useState, Suspense, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
const Page = lazy(() => import('SuperAdmin/Page'));
import type { FormInputConfig } from '../components/Form/types';
import { apiClient } from '../api/apiUtils';

export default function AddUser() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<Array<{ id: number; name: string }>>([]);
  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([]);
  const [loading, setLoading] = useState(true);

  // Fetch roles and locations from backend
  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        setLoading(true);

        // Fetch roles
        const rolesData = await apiClient.get('/users/roles');
        setRoles(rolesData.data || []);
        console.log('🎭 Fetched roles:', rolesData.data);

        const locationsData = await apiClient.get('/users/locations');
        setLocations(locationsData.data || []);
        console.log('📍 Fetched locations:', locationsData.data);
      } catch (error) {
        console.error('💥 Error fetching dropdown data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDropdownData();
  }, []);

  // Form inputs configuration
  const formInputs: FormInputConfig[] = [
    {
      name: 'fullName',
      type: 'text',
      label: 'Full Name',
      placeholder: 'Enter full name',
      required: true,
      row: 1,
      col: 1,
    },
    {
      name: 'email',
      type: 'email',
      label: 'Email Address',
      placeholder: 'Enter email address',
      required: true,
      row: 1,
      col: 2,
    },
    {
      name: 'phone',
      type: 'tel',
      label: 'Phone Number',
      placeholder: 'Enter phone number',
      required: true,
      row: 2,
      col: 1,
    },
    {
      name: 'password',
      type: 'password',
      label: 'Password',
      placeholder: 'Enter password',
      required: true,
      row: 2,
      col: 2,
      validation: {
        minLength: 8,
        pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      },
    },
    {
      name: 'roleId',
      type: 'dropdown',
      label: 'User Role',
      searchable: false,
      placeholder: 'Select User Role',
      options: roles.map((role) => ({
        value: role.id.toString(),
        label: role.name,
      })),
      required: true,
      row: 3,
      col: 1,
    },
    {
      name: 'locationId',
      type: 'dropdown',
      label: 'User Location',
      placeholder: 'Select Location',
      options: [
        { value: '', label: 'Select Location' },
        ...locations.map((location) => ({
          value: location.id.toString(),
          label: location.name,
        })),
      ],
      required: true,
      row: 3,
      col: 2,
    },
  ];

  const handleFormSubmit = async (formData: Record<string, any>) => {
    // Show confirmation dialog
    if (!window.confirm('Are you sure you want to create this user?')) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      console.log('Saving user data:', formData);

      // Validate required fields
      if (
        !formData.fullName ||
        !formData.email ||
        !formData.phone ||
        !formData.password ||
        !formData.roleId ||
        !formData.locationId
      ) {
        throw new Error('Please fill in all required fields');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        throw new Error('Please enter a valid email address');
      }

      // Validate phone format - only 10 digits allowed
      const phoneRegex = /^[0-9]{10}$/;
      const cleanPhone = formData.phone.replace(/\D/g, ''); // Remove all non-digits
      if (!phoneRegex.test(cleanPhone)) {
        throw new Error('Phone number must be exactly 10 digits (e.g., 9876543210)');
      }

      // Additional phone validation - should not start with 0
      if (cleanPhone.startsWith('0')) {
        throw new Error('Phone number cannot start with 0');
      }

      // Validate password strength
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
      if (!passwordRegex.test(formData.password)) {
        throw new Error(
          'Password must be at least 8 characters with uppercase, lowercase, number, and special character'
        );
      }

      // Prepare the user data for the API
      const userData = {
        firstName: formData.fullName.split(' ')[0] || formData.fullName,
        lastName: formData.fullName.split(' ').slice(1).join(' ') || '',
        email: formData.email.toLowerCase().trim(),
        phone: formData.phone.replace(/\D/g, ''), // Remove all non-digits (handles browser auto-formatting)
        password: formData.password,
        roleId: parseInt(formData.roleId, 10),
        locationId: parseInt(formData.locationId, 10),
        isActive: true,
        username: formData.email.toLowerCase().trim().split('@')[0], // Generate username from email
      };

      // Additional validation for role and location
      if (!userData.roleId || isNaN(userData.roleId)) {
        throw new Error('Please select a valid role');
      }

      if (!userData.locationId || isNaN(userData.locationId)) {
        throw new Error('Please select a valid location');
      }

      // Validate phone number length (should be exactly 10 digits)
      if (userData.phone.length !== 10) {
        throw new Error('Phone number must be exactly 10 digits');
      }

      // Make API call to create user
      const result = await apiClient.post('/users', userData);

      // Check for success - backend returns status: 'success' (not success: true)
      if (result.status === 'success' || result.success) {
        console.log('User created successfully:', result.data);

        // Navigate back to users list (no alert)
        navigate('/users');
      } else {
        // Extract error message from response
        const errorMessage =
          result.meta?.message ||
          result.error?.message ||
          result.message ||
          'Failed to create user';
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      console.error('Error creating user:', error);
      setError(error.message);
      // Don't navigate away on error, let user fix the form
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormCancel = () => {
    navigate('/users');
  };

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Page
        sections={[
          // Page Header Section
          {
            layout: {
              type: 'row' as const,
              gap: 'gap-4',
              rows: [
                {
                  layout: 'row' as const,
                  columns: [
                    {
                      name: 'PageHeader',
                      props: {
                        title: 'Add New User',
                        onBackClick: () => navigate('/users'),
                        backButtonText: 'Back to Users',
                        showMenu: false,
                        showDropdown: false,
                      },
                    },
                  ],
                },
              ],
            },
          },
          // Form Section
          {
            layout: {
              type: 'grid' as const,
              columns: 1,
              gap: 'gap-4',
              rows: [
                // Loading indicator
                ...(loading
                  ? [
                      {
                        layout: 'row' as const,
                        columns: [
                          {
                            name: 'div',
                            props: {
                              children: 'Loading form data...',
                              className: 'text-center text-gray-600 py-4',
                            },
                          },
                        ],
                      },
                    ]
                  : []),
                // Form
                {
                  layout: 'grid' as const,
                  gridColumns: 1,
                  gap: 'gap-4',
                  columns: [
                    {
                      name: 'Form',
                      props: {
                        inputs: formInputs,
                        onSubmit: handleFormSubmit,
                        submitLabel: isSubmitting ? 'Creating User...' : 'Create User',
                        cancelLabel: 'Cancel',
                        showFormActions: true,
                        cancelAction: handleFormCancel,
                        gridLayout: {
                          gridRows: 3,
                          gridColumns: 2,
                          gap: 'gap-3',
                          className: 'w-full',
                        },
                        errorMessages: error ? { general: error } : {},
                        showErrorsByDefault: true,
                        submitted: isSubmitting,
                        disabled: loading, // Disable form while loading
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
