import type { HeatmapLayerProps } from '@antv/larkmap';
import { HeatmapLayer, LarkMap } from '@antv/larkmap';

import { useEventContext } from '@/contexts/EventContext';
import React, { useEffect, useRef, useState } from 'react';

const SecurityMap: React.FC = () => {
  const { setSelectedEvent, allEvents, loading } = useEventContext();
  const heatmapLayerRef = useRef<any | null>(null);
  const [originalData, setOriginalData] = useState<any[]>([]); // 存储原始新闻数据

  useEffect(() => {
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.innerHTML = `
      window._AMapSecurityConfig = {
        securityJsCode: "db903491cb7f313e2b5ff1f667dcade0"
      };
    `;
    document.head.appendChild(script);
  }, []);

  const layerOptions: Omit<HeatmapLayerProps, 'source'> = {
    autoFit: true,
    shape: 'heatmap' as const,
    size: {
      field: 't',
      value: [0, 1],
    },
    style: {
      intensity: 3,
      radius: 20,
      opacity: 0.7,
      rampColors: {
        colors: ['#00008B', '#00BFFF', '#87CEEB', '#E0FFFF', '#F0FFFF'],
        positions: [0, 0.25, 0.5, 0.75, 1.0],
      },
    },
  };

  interface SourceData {
    x: number | null;
    y: number | null;
    t: number | null;
    c: number | null;
  }

  const [source, setSource] = useState<{
    data: SourceData[];
    parser: { type: string; x: string; y: string };
  }>({
    data: [],
    parser: { type: 'json', x: 'x', y: 'y' },
  });

  // 使用 EventContext 中的数据而不是重复发起请求
  useEffect(() => {
    if (!loading && allEvents && allEvents.length > 0) {
      // 保存原始数据
      setOriginalData(allEvents);

      // 转换数据为热力图所需格式
      const heatmapData = allEvents.map((item) => {
        // 处理emotion字段，确保c是数字类型
        let emotionValue: number | null = null;
        if (typeof item.emotion === 'number') {
          emotionValue = item.emotion;
        } else if (item.emotion && typeof item.emotion === 'object') {
          // 如果emotion是对象，可以从schema计算平均值或使用固定值
          emotionValue = 0.5; // 默认值
        }

        return {
          x: item.x || null,
          y: item.y || null,
          t: item.spreadRange || null,
          c: emotionValue,
        };
      });

      setSource((prev) => ({ ...prev, data: heatmapData }));
    }
  }, [allEvents, loading]);

  // 计算两点之间的地理距离（单位：米）
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371e3; // 地球半径（米）
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleLayerClick = (e: any) => {
    const clickedLngLat = e.lngLat;
    if (!clickedLngLat) return;

    // 查找最近的新闻数据项
    const closestItem = originalData.reduce((closest, current) => {
      const distance = calculateDistance(
        clickedLngLat.lat,
        clickedLngLat.lng,
        current.y, // 假设y是纬度
        current.x, // 假设x是经度
      );
      if (!closest) return current;
      return distance <
        calculateDistance(clickedLngLat.lat, clickedLngLat.lng, closest.y, closest.x)
        ? current
        : closest;
    }, null);

    if (closestItem) {
      setSelectedEvent?.(closestItem);
    }
  };

  // 地图文号样式
  const mapAttributionStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '5px',
    right: '5px',
    fontSize: '12px',
    color: '#333',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    padding: '2px 5px',
    borderRadius: '3px',
    zIndex: 100,
  };

  return (
    <div style={{
      position: 'relative',
      height: '100%',
      width: '100%',
      overflow: 'hidden',
      border: 'none',
      borderRadius: '8px'
    }}>
      <LarkMap
        mapType="Gaode"
        style={{ height: '100%' }}
        mapOptions={{
          token: '848c947552adbcc437808fc2b13a0a0c',
          style: 'light',
          zoom: 12,
          center: [116.403963, 39.914211],
        }}
        logoVisible={false}
      >
        {!loading && source.data.length > 0 && (
          <HeatmapLayer
            {...layerOptions}
            source={source}
            onCreated={(layer) => {
              heatmapLayerRef.current = layer;
              layer.on('click', handleLayerClick);
            }}
          />
        )}
      </LarkMap>
      <div style={mapAttributionStyle}>©2025 高德-GS（2024）1158号-甲测资字11112528-京ICP备2023020281号-12- ◎ 京公网安备 11010502030880号</div>
    </div>
  );
};

export default SecurityMap;
