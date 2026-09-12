-- 0002 新增水位时，存量阻断被填为 0。保守采用迁移时该猫的消息水位，
-- 禁止历史 explicit 消息重放解除删除；迁移后新的明确要求仍可解除。
UPDATE memory_blocks AS b
SET source_seq = COALESCE((
  SELECT max(m.seq)
  FROM messages AS m
  JOIN conversations AS c ON c.id = m.conversation_id
  WHERE c.cat_id = b.cat_id
), 0)
WHERE b.source_seq = 0;
