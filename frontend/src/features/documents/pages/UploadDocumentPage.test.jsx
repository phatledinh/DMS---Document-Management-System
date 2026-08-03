import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UploadDocumentPage from './UploadDocumentPage.jsx';

const navigate = vi.fn();
const uploadMutation = {
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
};

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
}));

vi.mock('react-toastify', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('../hooks/useUploadDocument.js', () => ({
  useUploadDocument: () => uploadMutation,
}));

vi.mock('../../../utils/response.js', () => ({
  getApiErrorMessage: (error) => error?.message || 'Có lỗi xảy ra',
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <UploadDocumentPage />
    </QueryClientProvider>,
  );
}

function getFileInput(container) {
  return container.querySelector('input[type="file"]');
}

describe('UploadDocumentPage', () => {
  beforeEach(() => {
    navigate.mockClear();
    uploadMutation.mutateAsync.mockReset();
    uploadMutation.mutateAsync.mockResolvedValue({ documentId: 42 });
    uploadMutation.isPending = false;
    uploadMutation.isError = false;
    uploadMutation.error = null;
  });

  it('rejects dangerous files before submitting upload-init', async () => {
    const user = userEvent.setup();
    const { toast } = await import('react-toastify');
    const { container } = renderPage();

    const file = new File(['bad'], 'payload.exe', { type: 'application/octet-stream' });
    await user.upload(getFileInput(container), file);

    expect(toast.error).toHaveBeenCalledWith('Định dạng file này không được phép upload.');
    expect(uploadMutation.mutateAsync).not.toHaveBeenCalled();
  });

  it('runs upload-init, presigned PUT, and upload-complete mutation for a valid PDF', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();

    const file = new File(['pdf'], 'policy.pdf', { type: 'application/pdf' });
    await user.upload(getFileInput(container), file);
    await user.type(screen.getByLabelText('Tiêu đề'), 'Chính sách chất lượng');
    await user.type(screen.getByLabelText('Danh mục'), '10');
    await user.click(screen.getByLabelText('Phòng ban'));
    await user.keyboard('20{Enter}');
    await user.click(screen.getByRole('button', { name: /upload/i }));

    await waitFor(() => expect(uploadMutation.mutateAsync).toHaveBeenCalled());
    const call = uploadMutation.mutateAsync.mock.calls[0][0];
    expect(call.file).toBe(file);
    expect(call.payload).toMatchObject({
      title: 'Chính sách chất lượng',
      categoryId: 10,
      accessLevel: 'DEPARTMENT',
      fileName: 'policy.pdf',
      fileSize: file.size,
      contentType: 'application/pdf',
    });
    expect(call.payload.departmentIds).toEqual([20]);
    expect(navigate).toHaveBeenCalledWith('/documents/42');
  });
});
