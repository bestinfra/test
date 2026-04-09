import { lazy } from 'react';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Suspense } from 'react';
const Page = lazy(() => import('SuperAdmin/Page'));
import type { FormInputConfig } from '../components/Form/types';
import BACKEND_URL from '../config';
import { getStoredToken, logout } from '../api/subAppAuth';

// Helper function to get the correct API URL
// Use the full API URL directly: http://localhost:3001/api/tickets
const getApiUrl = (endpoint: string): string => {
  // Check if we're in development (localhost) or production
  const isDevelopment = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       import.meta.env.DEV;
  
  // Determine base URL - use full URL directly
  let baseUrl: string;
  if (isDevelopment) {
    // Development: Use localhost:3001 directly as specified by user
    baseUrl = 'http://localhost:3001/api';
  } else {
    // Production: Extract domain from BACKEND_URL or use current origin
    const backendUrl = BACKEND_URL || '';
    if (backendUrl.startsWith('http')) {
      try {
        const urlObj = new URL(backendUrl);
        // Extract domain and port, always use /api (not /api/v1)
        baseUrl = `${urlObj.protocol}//${urlObj.host}/api`;
      } catch (e) {
        // Fallback: use current origin
        baseUrl = `${window.location.protocol}//${window.location.host}/api`;
      }
    } else {
      // Relative URL - use current origin
      baseUrl = `${window.location.origin}/api`;
    }
  }
  
  // Ensure endpoint doesn't start with /
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
  
  // Build final URL
  const finalUrl = `${baseUrl}/${normalizedEndpoint}`;
  
  console.log('📋 API URL Construction (AddTicket):');
  console.log('  - Environment:', isDevelopment ? 'Development (localhost)' : 'Production');
  console.log('  - Base URL:', baseUrl);
  console.log('  - Endpoint:', normalizedEndpoint);
  console.log('  - ✅ Final API URL:', finalUrl);
  
  return finalUrl;
};

// Helper function to make authenticated API requests
const authenticatedFetch = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  const token = getStoredToken();

  if (!token) {
    console.error('❌ No authentication token found!');
    throw new Error('Authentication required. Please login again.');
  }

  // Prepare headers with authentication
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  console.log('📤 Making API request to:', url);
  console.log('📤 Request method:', options.method || 'GET');

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      // Remove credentials: 'include' to avoid CORS issues
      // credentials: 'include',
    });

    console.log('📥 Response status:', response.status, response.statusText);

    // Handle token expiration (401 Unauthorized)
    if (response.status === 401) {
      console.error('❌ 401 Unauthorized - Token expired or invalid');
      console.warn('🔄 Redirecting to login...');
      logout();
      throw new Error('Your session has expired. Please login again.');
    }

    // Handle forbidden access (403)
    if (response.status === 403) {
      console.error('❌ 403 Forbidden - Access denied');
      console.warn('🔄 Redirecting to login...');
      logout();
      throw new Error('You do not have permission to access this resource.');
    }

    return response;
  } catch (error) {
    if (error instanceof Error && error.message.includes('session has expired')) {
      throw error;
    }
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network error: Unable to connect to server. Please check your internet connection.');
    }
    throw error;
  }
};

export default function AddTicket() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    // Success state - kept for potential future use (currently not displayed as user is redirected)
    const [success, setSuccess] = useState('');
    const [consumerId, setConsumerId] = useState(null);
    const [consumerName, setConsumerName] = useState('');
    const [consumerNumber, setConsumerNumber] = useState('');
    const [consumerMobile, setConsumerMobile] = useState('');
    const [consumerEmail, setConsumerEmail] = useState('');
    
    // Ref to store the latest consumer number from form (to avoid state updates during render)
    const consumerNumberRef = useRef<string>('');

    const priorityOptions = [
        { value: '', label: 'Select Priority' },
        { value: 'LOW', label: 'Low Priority' },
        { value: 'MEDIUM', label: 'Medium Priority' },
        { value: 'HIGH', label: 'High Priority' },
        { value: 'URGENT', label: 'Urgent Priority' },
    ];

    const categoryOptions = [
        { value: '', label: 'Select Category' },
        { value: 'BILLING', label: 'Billing Issue' },
        { value: 'METER', label: 'Meter Reading' },
        { value: 'CONNECTION', label: 'Connection/Disconnection' },
        { value: 'TECHNICAL', label: 'Technical Problem' },
        { value: 'OTHER', label: 'Other' },
    ];

    // Form inputs configuration
    const formInputs: FormInputConfig[] = [
        // Row 1: Consumer Number lookup
        {
            name: 'Consumer Number',
            type: 'text',
            label: 'Consumer Number',
            placeholder: 'Enter Consumer Number to lookup',
            required: true,
            row: 1,
            col: 1,
            defaultValue: consumerNumber,
        },
        {
            name: 'Consumer Name',
            type: 'text',
            label: 'Consumer Name',
            placeholder: 'Consumer Name (auto-filled)',
            required: true,
            row: 1,
            col: 2,
            defaultValue: consumerName,
        },
        {
            name: 'Mobile',
            type: 'text',
            label: 'Mobile',
            placeholder: 'Mobile (auto-filled)',
            required: true,
            row: 1,
            col: 3,
            defaultValue: consumerMobile,
        },
        // Row 2: Email and Priority
        {
            name: 'Email',
            type: 'text',
            label: 'Email',
            placeholder: 'Email (auto-filled)',
            required: true,
            row: 2,
            col: 1,
            defaultValue: consumerEmail,
        },
        {
            name: 'Priority',
            type: 'dropdown',
            label: 'Priority',
            options: priorityOptions,
            required: true,
            row: 2,
            col: 2,
        },
        {
            name: 'category',
            type: 'dropdown',
            label: 'Category',
            options: categoryOptions,
            required: true,
            row: 2,
            col: 3,
        },
        // Row 3: Subject
        {
            name: 'subject',
            type: 'text',
            label: 'Subject',
            placeholder: 'Enter Ticket Subject',
            required: true,
            row: 3,
            col: 1,
            colSpan: 3,
        },
        // Row 4: Full textarea
        {
            name: 'description',
            type: 'textareafield',
            label: 'Description',
            placeholder: 'Enter detailed description of the issue',
            required: true,
            row: 4,
            col: 1,
            colSpan: 3,
        },
        // Row 5: File upload
        {
            name: 'attachments',
            type: 'file',
            label: 'Attachments',
            required: false,
            row: 5,
            col: 1,
            colSpan: 3,
        },
    ];

    // Function to handle Consumer Number change and auto-populate fields
    async function handleConsumerNumberChange(consumerNumber: string) {
        // Don't update state here - it's already updated in handleFormChange
        // This function only handles the API call
        
        const trimmedNumber = consumerNumber?.trim() || '';
        const MIN_CONSUMER_NUMBER_LENGTH = 3;
        
        // Only proceed if consumer number meets minimum length requirement
        if (trimmedNumber && trimmedNumber.length >= MIN_CONSUMER_NUMBER_LENGTH) {
            try {
                setLoading(true);
                setError('');
                setSuccess('');
                
                // Call the API to get consumer details
                const url = getApiUrl(`tickets/consumer/${trimmedNumber}`);
                const response = await authenticatedFetch(url, {
                    method: 'GET',
                });

                if (response.ok) {
                    const result = await response.json();
                    
                    if (result.success && result.data) {
                        const consumerData = result.data;
                        
                        // Auto-populate the fields
                        setConsumerId(consumerData.consumerId);
                        setConsumerName(consumerData.name || '');
                        setConsumerMobile(consumerData.primaryPhone || '');
                        setConsumerEmail(consumerData.email || '');
                        
                        // Show success message
                        setSuccess(`Consumer found! Name: ${consumerData.name}, Location: ${consumerData.location || '-'}`);
                    } else {
                        setError('Consumer not found. Please check the consumer number.');
                        setConsumerId(null);
                        setConsumerName('');
                        setConsumerMobile('');
                        setConsumerEmail('');
                    }
                } else {
                    // Handle 404 and other errors gracefully
                    if (response.status === 404) {
                        setError('Consumer not found. Please check the consumer number.');
                    } else {
                        setError('Failed to fetch consumer details');
                    }
                    setConsumerId(null);
                    setConsumerName('');
                    setConsumerMobile('');
                    setConsumerEmail('');
                }
            } catch (error: any) {
                console.error('Error fetching consumer details:', error);
                // Don't show error for 404s or network errors during typing
                if (error.message && error.message.includes('404')) {
                    setError('Consumer not found. Please check the consumer number.');
                } else if (error.message && error.message.includes('session has expired')) {
                    // Don't set error, logout will handle redirect
                    return;
                } else {
                    setError('Error fetching consumer details. Please try again.');
                }
                setConsumerId(null);
                setConsumerName('');
                setConsumerMobile('');
                setConsumerEmail('');
            } finally {
                setLoading(false);
            }
        }
        // If consumer number is too short, don't make API call and don't show error
        // The error will be cleared in the useEffect if length < MIN_CONSUMER_NUMBER_LENGTH
    }

    // Handle form data changes - only update local ref, don't trigger API call here
    const handleFormChange = (newFormData: Record<string, any>) => {
        // Update the ref with the new consumer number
        const newConsumerNumber = newFormData['Consumer Number'] || '';
        consumerNumberRef.current = newConsumerNumber;
        
        // Update state immediately for display (this is safe as it's just updating display state)
        if (newConsumerNumber !== consumerNumber) {
            setConsumerNumber(newConsumerNumber);
            
            // Clear error immediately if input is too short (less than 3 characters)
            const trimmedNumber = newConsumerNumber.trim();
            const MIN_CONSUMER_NUMBER_LENGTH = 3;
            if (trimmedNumber.length > 0 && trimmedNumber.length < MIN_CONSUMER_NUMBER_LENGTH) {
                setError(''); // Clear error immediately when input is too short
            }
        }
    };

    // Use useEffect with debounce to handle consumer number lookup
    // This prevents state updates during render and debounces API calls
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            const currentConsumerNumber = consumerNumberRef.current;
            const trimmedNumber = currentConsumerNumber?.trim() || '';
            
            // Only make API call if consumer number has minimum length (e.g., 3 characters)
            // This prevents API calls for single characters or very short inputs
            const MIN_CONSUMER_NUMBER_LENGTH = 3;
            
            if (trimmedNumber && trimmedNumber.length >= MIN_CONSUMER_NUMBER_LENGTH && trimmedNumber === consumerNumber.trim()) {
                handleConsumerNumberChange(trimmedNumber);
            } else if (!trimmedNumber || trimmedNumber.length === 0) {
                // Clear fields if consumer number is empty
                setConsumerId(null);
                setConsumerName('');
                setConsumerMobile('');
                setConsumerEmail('');
                setSuccess('');
                setError('');
            } else if (trimmedNumber.length < MIN_CONSUMER_NUMBER_LENGTH) {
                // Clear error if user is still typing (too short)
                setError('');
                setConsumerId(null);
                setConsumerName('');
                setConsumerMobile('');
                setConsumerEmail('');
                setSuccess('');
            }
        }, 500); // Debounce: wait 500ms after user stops typing

        return () => clearTimeout(timeoutId);
    }, [consumerNumber]); // Only re-run when consumerNumber state changes

    const handleFormSubmit = async (formData: Record<string, any>) => {
        try {
            setLoading(true);
            setError('');

            // Prepare the data for the API
            const ticketData = {
                subject: formData.subject,
                description: formData.description,
                type: 'COMPLAINT',
                category: formData.category,
                priority: formData.Priority.toUpperCase(),
                // Consumer relation
                consumerId: consumerId,
                attachments: formData.attachments || null,
            };

            const url = getApiUrl('tickets');
            const response = await authenticatedFetch(url, {
                method: 'POST',
                body: JSON.stringify(ticketData),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('📥 Ticket creation response:', result);

            // Check for success using status field (new API structure)
            if (result.status === 'success' || result.success) {
                setSuccess('Ticket created successfully!');
                // Navigate back after successful creation
                setTimeout(() => {
                    navigate('/tickets');
                }, 1500);
            } else {
                setError(result.message || 'Failed to create ticket');
            }
        } catch (error) {
            console.error('Error creating ticket:', error);
            setError('Error creating ticket. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleFormCancel = () => {
        navigate('/tickets');
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
                                                title: 'Create New Ticket',
                                                onBackClick: () => navigate('/tickets'),
                                                showMenu: false,
                                                showDropdown: false,
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    },
                    // Error Display Section
                    ...(error ? [{
                        layout: {
                            type: 'column' as const,
                            gap: 'gap-4',
                            rows: [
                                {
                                    layout: 'column' as const,
                                    columns: [
                                        {
                                            name: 'Error',
                                            props: {
                                                visibleErrors: [error],
                                                showRetry: false,
                                                maxVisibleErrors: 1,
                                                onClose: () => setError(''),
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    }] : []),
                    // Success Display Section - Show success message as a simple info banner
                    ...(success ? [{
                        layout: {
                            type: 'column' as const,
                            gap: 'gap-4',
                            rows: [
                                {
                                    layout: 'column' as const,
                                    columns: [
                                        {
                                            name: 'Error',
                                            props: {
                                                visibleErrors: [success],
                                                showRetry: false,
                                                maxVisibleErrors: 1,
                                                onClose: () => setSuccess(''),
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    }] : []),
                    // Form Section
                    {
                        layout: {
                            type: 'grid' as const,
                            columns: 1,
                            gap: 'gap-4',
                            rows: [
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
                                                submitLabel: loading ? 'Creating...' : 'Submit',
                                                cancelLabel: 'Cancel',
                                                showFormActions: true,
                                                cancelAction: handleFormCancel,
                                                gridLayout: {
                                                    gridRows: 4,
                                                    gridColumns: 3,
                                                    gap: 'gap-4',
                                                    className: 'w-full',
                                                },
                                                formBackground:
                                                    'bg-white dark:bg-gray-800 border border-primary-border dark:border-gray-700 p-4 rounded-2xl ',
                                                className: 'w-full',
                                                disabled: loading,
                                                onChange: handleFormChange,
                                                initialData: {
                                                    'Consumer Number': consumerNumber,
                                                    'Consumer Name': consumerName,
                                                    'Mobile': consumerMobile,
                                                    'Email': consumerEmail,
                                                },
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
