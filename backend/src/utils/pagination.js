const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * Parses page/pageSize query params into safe, bounded integers.
 */
function parsePagination(query) {
  let page = Number.parseInt(query.page, 10);
  if (!Number.isInteger(page) || page < 1) page = 1;

  let pageSize = Number.parseInt(query.pageSize, 10);
  if (!Number.isInteger(pageSize) || pageSize < 1) pageSize = DEFAULT_PAGE_SIZE;
  if (pageSize > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE;

  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

function buildPaginationMeta(page, pageSize, total) {
  return {
    page,
    pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}

module.exports = { parsePagination, buildPaginationMeta };
