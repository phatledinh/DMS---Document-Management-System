import { Flex, Spin, Typography } from 'antd';

export default function PageLoading({ label = 'Đang tải...' }) {
  return (
    <Flex vertical align="center" justify="center" style={{ minHeight: '100vh' }} gap={16}>
      <Spin size="large" />
      <Typography.Text type="secondary">{label}</Typography.Text>
    </Flex>
  );
}
