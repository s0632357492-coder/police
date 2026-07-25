const config = require('../../config/config');

/** ตรวจสอบว่าสมาชิกมี Role ในรายการที่กำหนดหรือไม่ */
function hasAnyRole(member, roleIds) {
  if (!member || !roleIds?.length) return false;
  return roleIds.some((id) => member.roles.cache.has(id));
}

/** สิทธิ์ระดับ Admin ของบอท (on247, spch, devtool, setreason) */
function isBotAdmin(member) {
  if (member.permissions?.has('Administrator')) return true;
  return hasAnyRole(member, config.ADMIN_ROLE_IDS);
}

/** ผู้ที่มีสิทธิ์สูงกว่าสมาชิกทั่วไป (ใช้ยกเว้นการป้องกันของ Special Role) */
function isPrivileged(member) {
  if (!member) return false;
  if (member.permissions?.has('Administrator')) return true;
  if (member.permissions?.has('KickMembers') || member.permissions?.has('ModerateMembers')) return true;
  return isBotAdmin(member);
}

/** น้ำหนักเสียงโหวตของสมาชิก */
function getVoteWeight(member) {
  return hasAnyRole(member, config.VOTE_WEIGHTED_ROLE_IDS) ? 2 : 1;
}

module.exports = { hasAnyRole, isBotAdmin, isPrivileged, getVoteWeight };
