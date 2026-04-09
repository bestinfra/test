import { lazy } from 'react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api/subAppAuth.ts';
import { useAuth } from '../components/auth/LocalAuthWrapper';
import { setStoredToken, setStoredUser, AUTH_CONFIG } from '../config/auth';
const Page = lazy(() => import('SuperAdmin/Page'));
interface CarouselSlide {
  title: string;
  img: string;
  description: string;
}
type FormInputValue = string | string[] | number | boolean | FileList | File | null | undefined;

const slides: CarouselSlide[] = [
  // {
  //   title: 'Welcome to the Sub-App!',
  //   img: 'images/Slide1.jpg',
  //   description:
  //     'Optimize energy use with real-time monitoring, anomaly detection, and a centralized dashboard for smarter, cost-effective decisions.',
  // },
  {
    title: 'Feature Highlight',
    img: 'images/Slide2.jpg',
    description:
      'Optimize energy use with real-time monitoring, anomaly detection, and a centralized dashboard for smarter, cost-effective decisions.',
  },
  {
    title: 'Stay Connected',
    img: 'images/Slide3.jpg',
    description:
      'Optimize energy use with real-time monitoring, anomaly detection, and a centralized dashboard for smarter, cost-effective decisions.',
  },
];

const SubLogin: React.FC = () => {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState<string>('');
  const [modalTitle, setModalTitle] = useState<string>('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const { isAuthenticated, updateAuthState } = useAuth();
  const navigate = useNavigate();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  // Modal content data
  const termsOfServiceContent = `Last updated: January 1, 2024

1. Acceptance of Terms
By accessing and using this application, you accept and agree to be bound by the terms and provision of this agreement.

2. Use License
Permission is granted to temporarily download one copy of the application for personal, non-commercial transitory viewing only.

3. Disclaimer
The materials on this application are provided on an 'as is' basis. We make no warranties, expressed or implied, and hereby disclaim and negate all other warranties including without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.

4. Limitations
In no event shall we or our suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on our application.

5. Revisions and Errata
The materials appearing on our application could include technical, typographical, or photographic errors. We do not warrant that any of the materials on our application are accurate, complete or current.

6. Links
We have not reviewed all of the sites linked to our application and are not responsible for the contents of any such linked site.

7. Modifications
We may revise these terms of service for our application at any time without notice.`;

  const privacyPolicyContent = `Last updated: January 1, 2024

1. Information We Collect
We collect information you provide directly to us, such as when you create an account, log in, or contact us for support.

2. How We Use Your Information
We use the information we collect to:
• Provide, maintain, and improve our services
• Process transactions and send related information
• Send technical notices, updates, security alerts, and support messages
• Respond to your comments, questions, and customer service requests

3. Information Sharing
We do not share, sell, or otherwise disclose your personal information for purposes other than those outlined in this Privacy Policy.

4. Data Security
We have implemented appropriate technical and organizational security measures designed to protect the security of any personal information we process.

5. Data Retention
We will retain your personal information only for as long as is necessary for the purposes set out in this Privacy Policy.

6. Your Rights
You have the right to:
• Access your personal information
• Correct inaccurate personal information
• Request deletion of your personal information
• Object to our processing of your personal information

7. Changes to This Policy
We may update this privacy policy from time to time. We will notify you of any changes by posting the new policy on this page.

8. Contact Us
If you have any questions about this Privacy Policy, please contact us.`;

  const handleModalOpen = (title: string, content: string) => {
    setModalTitle(title);
    setModalContent(content);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setModalContent('');
    setModalTitle('');
  };

  const handleForgotPassword = () => {
    setShowForgotPassword(true);
  };

  const handleLogin = async (data: Record<string, FormInputValue>) => {
    setError('');
    setLoading(true);

    try {
      const result = await login({
        identifier: data.identifier as string,
        password: data.password as string,
        appId: window.location.hostname || 'sub-app',
        rememberMe: data.rememberMe as boolean,
      });
      
      if (result.success && result.data) {
        const rememberMe = data.rememberMe as boolean;
        const token = result.data.accessToken;
        
        if (!token) {
          console.error('❌ [SubLogin] No token received from login');
          setError('Login failed: No token received');
          return;
        }
        
        // Console log only the token as requested
        console.log('🔐 [SubLogin] Token:', token);
        
        // Store token and user in localStorage if rememberMe is true, otherwise sessionStorage
        setStoredToken(token, rememberMe);
        setStoredUser(result.data.user, rememberMe);

        // Also set accessToken so apiUtils and any legacy code find the token (fixes live/production)
        if (rememberMe) {
          localStorage.setItem('accessToken', token);
        } else {
          sessionStorage.setItem('accessToken', token);
        }

      // Also store refresh token for token refresh functionality
      // Refresh tokens are always stored in localStorage for persistence
      if (result.data.refreshToken) {
        localStorage.setItem('refreshToken', result.data.refreshToken);
        localStorage.setItem(`${AUTH_CONFIG.TOKEN_KEY}_refresh`, result.data.refreshToken);
      }

      // Update the auth context state to reflect the new authentication
      updateAuthState();

      // Navigate to dashboard after successful login
      navigate('/');
      } else {
        const errorMessage = result.message || 'Login failed. Please check your credentials.';
        console.error('❌ [SubLogin] Login failed:', errorMessage);
        setError(errorMessage);
      }
    } catch (error) {
      console.error('❌ [SubLogin] Login error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Network error. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (data: Record<string, FormInputValue>) => {
    setError('');
    setLoading(true);

    try {
      console.log('Forgot password for:', data.email);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setError('Password reset link sent to your email!');
    } catch (error) {
      console.error('Forgot password error:', error);
      setError('Failed to send reset link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Form inputs configuration
  const forgotPasswordInputs = [
    {
      name: 'errorLabel',
      type: 'label',
      label: error || '',
      row: 1,
      col: 1,
      colSpan: 2,
      labelClassName: error ? 'text-red-500 text-sm font-medium text-center' : 'hidden',
    },
    {
      name: 'email',
      type: 'email',
      placeholder: 'Email Address',
      required: true,
      row: 2,
      col: 1,
      colSpan: 2,
      validation: {
        custom: (value: FormInputValue) => {
          if (!value) return 'Email is required';
          if (typeof value === 'string' && !value.includes('@')) {
            return 'Please enter a valid email address';
          }
          return null;
        },
      },
    },
  ];

  const loginInputs = [
    {
      name: 'identifier',
      type: 'text',
      placeholder: 'Email or Username',
      required: true,
      row: 2,
      col: 1,
      colSpan: 2,
      rightIcon: 'icons/user.svg',
      validation: {
        custom: (value: FormInputValue) => (!value ? 'Username or email is required' : null),
      },
    },
    {
      name: 'password',
      type: 'password',
      placeholder: 'Enter your password',
      required: true,
      showPasswordToggle: true,
      row: 3,
      col: 1,
      colSpan: 2,
      validation: {
        minLength: 6,
        custom: (value: FormInputValue) => {
          if (!value) return 'Password is required';
          if (typeof value === 'string' && value.length < 6)
            return `Password must be at least 6 characters`;
          return null;
        },
      },
    },
    {
      name: 'rememberMe',
      type: 'checkbox',
      label: 'Keep me signed in',
      defaultValue: true,
      row: 4,
      col: 1,
      colSpan: 1,
      className: 'justify-start',
    },
    {
      name: 'forgotPassword',
      type: 'label',
      label: 'Forgot Password?',
      row: 4,
      col: 2,
      colSpan: 1,
      labelClassName: 'w-full flex justify-end',
      onClick: handleForgotPassword,
    },
  ];

  return (
    <div className="h-screen overflow-hidden scroll-y-hidden">
      <Page
        sections={[
          {
            layout: {
              type: 'grid',
              className: 'rounded-lg min-h-screen bg-primary-lightest',
              columns: 5,
              gap: 'gap-1',
              gridRows: 1,
              rows: [
                {
                  layout: 'row',
                  className: 'rounded-lg h-full p-4',
                  span: { col: 3, row: 1 },
                  columns: [
                    {
                      name: 'SplitSlideshow',
                      props: {
                        slides,
                        enableGlass: true,
                        showDots: true,
                        autoPlayInterval: 3000,
                        transition: 'none',
                      },
                    },
                  ],
                },
                {
                  layout: 'grid',
                  className: 'rounded-lg h-full justify-betweens py-4 pr-4',
                  span: { col: 2, row: 1 },
                  gridColumns: 2,
                  columns: [
                    {
                      name: 'SectionHeader',
                      props: {
                        title: 'Back to Website',
                        titleLevel: 2,
                        titleSize: 'lg',
                        titleWeight: 'normal',
                        titleVariant: 'success',
                        iconBg: 'bg-primary',
                        className: '',
                        icon: 'arrow-left',
                        iconSize: 'lg',
                      },
                      span: { col: 2, row: 1 },
                    },
                    {
                      name: 'LoginV2',
                      span: { col: 2, row: 1 },
                      props: {
                        buttonLabel: showForgotPassword ? 'Send Verification Code' : 'Login',
                        rememberMeLabel: 'Keep me signed in',
                        minPasswordLength: 6,
                        identifierPlaceholder: 'Email or Username',
                        passwordPlaceholder: 'Enter your password',
                        inputs: showForgotPassword ? forgotPasswordInputs : loginInputs,
                        onSubmit: showForgotPassword ? handleForgotPasswordSubmit : handleLogin,
                        loading,
                        error,
                      },
                    },
                    {
                      name: 'SectionHeader',
                      span: { col: 2, row: 1 },
                      props: {
                        title: 'Need Help? Contact Support',
                        titleLevel: 3,
                        titleSize: 'lg',
                        titleWeight: 'normal',
                        className: 'h-full items-end',
                        titleVariant: 'muted',
                        titleClassName: 'items-end',
                        titleParts: {
                          prefix: 'Need Help? ',
                          suffix: 'Contact Support',
                          suffixVariant: 'success',
                          suffixClassName: 'cursor-pointer',
                          suffixOnClick: () => {
                            console.log('Contact Support clicked');
                          },
                        },
                        rightLabels: [
                          {
                            label: 'Terms of Service',
                            size: 'lg',
                            variant: 'success',
                            weight: 'normal',
                            className: 'cursor-pointer hover:opacity-80',
                            onClick: () => {
                              handleModalOpen('Terms of Service', termsOfServiceContent);
                            },
                          },
                          {
                            label: 'Privacy Policy',
                            size: 'lg',
                            variant: 'success',
                            weight: 'normal',
                            className: 'cursor-pointer hover:opacity-80',
                            onClick: () => {
                              handleModalOpen('Privacy Policy', privacyPolicyContent);
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              ],
            },
          },
          {
            layout: {
              type: 'row',
              className: '',
              gap: 'gap-1',
            },
            components: [
              {
                name: 'Modal',
                props: {
                  isOpen: modalOpen,
                  onClose: handleModalClose,
                  title: modalTitle,
                  size: 'xl',
                  showCloseIcon: true,
                  backdropClosable: true,
                  centered: true,
                  content: modalContent,
                  contentType: 'html',
                },
              },
            ],
          },
        ]}
      />
    </div>
  );
};

export default SubLogin;
