import { type IconType } from 'react-icons';
import {
  FaMoneyBillWave,
  FaChartBar,
  FaUsers,
  FaCog,
  FaTicketAlt,
  FaCalendarAlt,
  FaFileAlt,
  FaBell,
} from 'react-icons/fa';
import type { ReactNode } from 'react';

export interface TableData {
  [key: string]: string | number | boolean | null | undefined;
}

export interface Column {
  key: string;
  label: string;
  render?: (value: string | number | boolean | null | undefined, row: TableData) => ReactNode;
  priorityBadge?: boolean;
  statusIndicator?: {
    activeColor?: string;
    inactiveColor?: string;
  };
  isActive?: (value: string | number | boolean | null | undefined) => boolean;
  align?: 'left' | 'center' | 'right';
  spacing?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | string;
  autoDateFormat?: boolean;
}

export interface Module {
  id: string;
  name: string;
  description: string;
  pages: ModulePage[];
  icon: IconType;
  color: string;
}

export interface ModulePage {
  id: string;
  name: string;
  description: string;
  path: string;
  icon: IconType;
}

export const AVAILABLE_MODULES: Module[] = [
  {
    id: 'billing',
    name: 'Billing',
    description: 'Manage billing and invoicing',
    icon: FaMoneyBillWave,
    color: 'bg-blue-500',
    pages: [
      {
        id: 'invoices',
        name: 'Invoices',
        description: 'View and manage invoices',
        path: '/billing/invoices',
        icon: FaFileAlt,
      },
      {
        id: 'payments',
        name: 'Payments',
        description: 'Track payments and transactions',
        path: '/billing/payments',
        icon: FaMoneyBillWave,
      },
    ],
  },
  {
    id: 'reports',
    name: 'Reports',
    description: 'Generate and view reports',
    icon: FaChartBar,
    color: 'bg-purple-500',
    pages: [
      {
        id: 'analytics',
        name: 'Analytics',
        description: 'View detailed analytics',
        path: '/reports/analytics',
        icon: FaChartBar,
      },
      {
        id: 'exports',
        name: 'Exports',
        description: 'Export report data',
        path: '/reports/exports',
        icon: FaFileAlt,
      },
    ],
  },
  {
    id: 'ticketing',
    name: 'Ticketing',
    description: 'Manage support tickets and customer issues',
    icon: FaTicketAlt,
    color: 'bg-green-500',
    pages: [
      {
        id: 'tickets',
        name: 'Tickets',
        description: 'View and manage support tickets',
        path: '/ticketing/tickets',
        icon: FaTicketAlt,
      },
      {
        id: 'categories',
        name: 'Categories',
        description: 'Manage ticket categories',
        path: '/ticketing/categories',
        icon: FaFileAlt,
      },
    ],
  },
  {
    id: 'users',
    name: 'User Management',
    description: 'Manage users and permissions',
    icon: FaUsers,
    color: 'bg-red-500',
    pages: [
      {
        id: 'users',
        name: 'Users',
        description: 'Manage user accounts',
        path: '/users/list',
        icon: FaUsers,
      },
      {
        id: 'roles',
        name: 'Roles',
        description: 'Manage user roles and permissions',
        path: '/users/roles',
        icon: FaCog,
      },
    ],
  },
  {
    id: 'calendar',
    name: 'Calendar',
    description: 'Schedule and manage events',
    icon: FaCalendarAlt,
    color: 'bg-yellow-500',
    pages: [
      {
        id: 'events',
        name: 'Events',
        description: 'Manage calendar events',
        path: '/calendar/events',
        icon: FaCalendarAlt,
      },
      {
        id: 'schedules',
        name: 'Schedules',
        description: 'View and manage schedules',
        path: '/calendar/schedules',
        icon: FaCalendarAlt,
      },
    ],
  },
  {
    id: 'notifications',
    name: 'Notifications',
    description: 'Manage system notifications',
    icon: FaBell,
    color: 'bg-pink-500',
    pages: [
      {
        id: 'settings',
        name: 'Settings',
        description: 'Configure notification settings',
        path: '/notifications/settings',
        icon: FaCog,
      },
      {
        id: 'templates',
        name: 'Templates',
        description: 'Manage notification templates',
        path: '/notifications/templates',
        icon: FaFileAlt,
      },
    ],
  },
];
