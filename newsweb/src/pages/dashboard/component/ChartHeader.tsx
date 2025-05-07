import React, { ReactNode } from 'react';
import { Divider } from 'antd';

interface ChartHeaderProps {
  icon: ReactNode;
  title: string;
  extra?: ReactNode;
}

/**
 * Standardized header component for dashboard charts
 * @param icon - Icon component (must be blue #108ee9)
 * @param title - Chart title
 * @param extra - Optional extra elements to display on the right side
 */
const ChartHeader: React.FC<ChartHeaderProps> = ({ icon, title, extra }) => {
  return (
    <>
      <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: '18px', color: '#108ee9', marginRight: '8px' }}>{icon}</span>
          <span style={{ fontSize: '14px', color: '#000000', fontWeight: 'bold' }}>{title}</span>
        </div>
        {extra && <div>{extra}</div>}
      </div>
      <Divider style={{ margin: '0 0 12px 0', backgroundColor: '#e8e8e8' }} />
    </>
  );
};

export default ChartHeader;
