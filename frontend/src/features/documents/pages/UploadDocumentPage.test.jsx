import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

vi.mock('../../dashboard/hooks/useUserDashboard.js', () => ({
  useUserDashboard: () => ({
    isSuccess: true,
    data: { permissionGroups: [{ categoryId: 10, permissions: ['UPLOAD'] }] },
  }),
}));

vi.mock('../../../store/authStore.js', () => ({
  useAuthStore: (selector) => selector({ user: { id: 1, role: 'USER' } }),
}));

vi.mock('../../../api/categoryApi.js', () => ({
  getCategories: vi.fn().mockResolvedValue([{ id: 10, name: 'Chính sách', parentId: null }]),
}));

vi.mock('../../../api/tagApi.js', () => ({
  getTags: vi.fn().mockResolvedValue([]),
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
    const categoryInput = container.querySelector('.ant-select-selection-search-input');
    fireEvent.mouseDown(categoryInput);
    await user.click(await screen.findByText('Chính sách'));
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
    });
    expect(call.payload).not.toHaveProperty('accessLevel');
    expect(call.payload).not.toHaveProperty('visibility');
    expect(call.payload).not.toHaveProperty('departmentIds');
  });
});
