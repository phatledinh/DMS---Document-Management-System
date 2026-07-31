export function unwrapApiResponse(response) {
  return response.data?.data ?? null;
}

export function getApiErrorMessage(error) {
  return error.response?.data?.message || error.message || 'Có lỗi xảy ra';
}
