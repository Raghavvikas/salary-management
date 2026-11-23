import { BarChartOutlined, TeamOutlined } from '@ant-design/icons';
import { Layout, Menu, Typography } from 'antd';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { DashboardPage } from './pages/DashboardPage';
import { DirectoryPage } from './pages/DirectoryPage';

const { Header, Content } = Layout;

export function App() {
  const { pathname } = useLocation();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        <Typography.Text strong style={{ color: '#fff', fontSize: 16 }}>
          ACME · Salary Management
        </Typography.Text>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[pathname.startsWith('/directory') ? '/directory' : '/dashboard']}
          style={{ flex: 1, minWidth: 0 }}
          items={[
            {
              key: '/dashboard',
              icon: <BarChartOutlined />,
              label: <Link to="/dashboard">How we pay</Link>,
            },
            {
              key: '/directory',
              icon: <TeamOutlined />,
              label: <Link to="/directory">Employees</Link>,
            },
          ]}
        />
      </Header>
      <Content style={{ padding: 24, maxWidth: 1400, width: '100%', margin: '0 auto' }}>
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/directory" element={<DirectoryPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Content>
    </Layout>
  );
}
