import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from '@/context/AppContext';
import { AuthProvider } from '@/components/auth/LocalAuthWrapper';
import ProtectedRoute from '@/components/auth/LocalProtectedRoute';
import AppLayout from '@/components/AppLayout';
import Login from '@/pages/SubLogin';
import ConsumerDashboard from '@/pages/ConsumerDashboard';
import IndividualDetailPage from '@/pages/IndividualDetailPage';
import Consumers from '@/pages/Consumers';
import ConsumerDetailView from '@/pages/ConsumerDetailView';
import AssetManagement from '@/pages/AssetManagement';
import UserDetail from '@/pages/UserDetail';
import AddUser from '@/pages/AddUser';
import RolesPermissions from '@/pages/RolesPermissions';
import Users from '@/pages/Users';
import RoleManagement from '@/pages/RoleManagement';
import Tickets from '@/pages/Tickets';
import TicketView from '@/pages/TicketView';
import AddTicket from '@/pages/AddTicket';
import Postpaid from '@/pages/Postpaid';
import MeterAlert from "@/pages/MeterAlert"
import Instantaneous from "@/pages/Instantaneous"
import MDReport from "@/pages/MDReport"
import Prepaid from "@/pages/Prepaid"
import PrepaidDetail from "@/pages/PrepaidDetail"
import OccupancyStatus from "@/pages/OccupancyStatus"
import Commands from "@/pages/Commands"
import LSData from './pages/LSData';
import MeterAlerts from '@/pages/MeterAlerts';
import LSDataIndividual from '@/pages/LSDataIndividual';
const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppProvider >
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/occupancy-status"
              element={<OccupancyStatus />}
            />
            <Route
              path="/occupancy-status/:meterNumber"
              element={<OccupancyStatus />}
            />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                      <Routes>
                        <Route path="/" element={<ConsumerDashboard />} />
                        <Route path="/individual-detail" element={<IndividualDetailPage />} />
                        <Route path="/consumers" element={<Consumers />} />
                        <Route path="/consumers/:consumerId" element={<ConsumerDetailView />} />
                        <Route path="/asset-management" element={<AssetManagement />} />
                        <Route path="/users" element={<Users />} />
                        <Route path="/users/:userId" element={<UserDetail />} />
                        <Route path="/add-user" element={<AddUser />} />
                        <Route path="/role-management" element={<RoleManagement />} />
                        <Route path="/tickets" element={<Tickets />} />
                        <Route path="/tickets/:ticketId" element={<TicketView />} />
                        <Route path="/add-ticket" element={<AddTicket />} />
                        <Route path="/bills/prepaid" element={<Prepaid />} />
                        <Route path="/bills/prepaid/detail/:widgetType" element={<PrepaidDetail />} />
                        <Route path="/bills/postpaid" element={<Postpaid />} />
                        <Route path='/meter-alerts' element={<MeterAlerts />} />
                        <Route path='/reports' element={<MeterAlert />} />
                        <Route path='/instantaneous' element={<Instantaneous />} />
                        <Route path='/md-report' element={<MDReport />} />
                        <Route path="/commands" element={<Commands />} />
                        <Route path="/consumer-dashboard" element={<ConsumerDashboard />} />
                        <Route path="/role-permission" element={<RolesPermissions />} />
                        <Route path="/lsdata" element={<LSData />} />
                        <Route path="/lsdata-individual/:id" element={<LSDataIndividual />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </Suspense>
                  </AppLayout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Router>
      </AppProvider>
    </AuthProvider>
  );
};
export default App;