package com.zhanx.dental.repository;

import com.zhanx.dental.model.ClinicSetting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ClinicSettingRepository extends JpaRepository<ClinicSetting, Short> {
}
