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
    warning: vi.fn(),
  },
}));

vi.mock('../hooks/useBatchUploadDocuments.js', () => ({
  useBatchUploadDocuments: () => uploadMutation,
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
    uploadMutation.mutateAsync.mockResolvedValue({
      init: { succeeded: 1, failed: 0, items: [] },
      complete: { succeeded: 1, failed: 0, items: [] },
    });
    uploadMutation.isPending = false;
    uploadMutation.isError = false;
    uploadMutation.error = null;
  });

  it('rejects dangerous files before submitting batch upload-init', async () => {
    const user = userEvent.setup();
    const { toast } = await import('react-toastify');
    const { container } = renderPage();

    const file = new File(['bad'], 'payload.exe', { type: 'application/octet-stream' });
    await user.upload(getFileInput(container), file);

    expect(toast.error).toHaveBeenCalledWith('Định dạng file này không được phép upload.');
    expect(uploadMutation.mutateAsync).not.toHaveBeenCalled();
  });

  it('runs batch upload mutation for a valid PDF', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();

    const file = new File(['pdf'], 'policy.pdf', { type: 'application/pdf' });
    await user.upload(getFileInput(container), file);
    await user.type(screen.getByLabelText('Danh mục'), '10');
    await user.click(screen.getByLabelText('Phòng ban'));
    await user.keyboard('20{Enter}');
    await user.click(screen.getByRole('button', { name: /upload/i }));

    await waitFor(() => expect(uploadMutation.mutateAsync).toHaveBeenCalled());
    const call = uploadMutation.mutateAsync.mock.calls[0][0];
    expect(Object.values(call.filesByClientItemId)).toContain(file);
    expect(call.payload.files[0]).toMatchObject({
      fileName: 'policy.pdf',
      fileSize: file.size,
      contentType: 'application/pdf',
      title: 'policy',
    });
    expect(call.payload).toMatchObject({
      categoryId: 10,
      accessLevel: 'DEPARTMENT',
      visibility: 'DEPARTMENT',
    });
    expect(call.payload.departmentIds).toEqual([20]);
  });
});
