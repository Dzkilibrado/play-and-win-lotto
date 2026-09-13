UPDATE public.pool_documents AS document
SET is_published = true
FROM public.pools AS pool
WHERE document.pool_id = pool.id
  AND pool.name = 'Bolão Galera Gmill'
  AND document.deleted_at IS NULL
  AND document.title = 'Picpay'
  AND document.original_file_name = 'DOC-20260912-WA0064.pdf';