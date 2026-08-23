import { Button, Result } from 'antd';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <Result
      status="404"
      title="Không tìm thấy trang"
      subTitle="Đường dẫn bạn truy cập không tồn tại."
      extra={<Button type="primary"><Link to="/">Về trang chủ</Link></Button>}
    />
  );
}
