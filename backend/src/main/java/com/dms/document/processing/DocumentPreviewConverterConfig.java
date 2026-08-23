package com.dms.document.processing;

import org.jodconverter.core.DocumentConverter;
import org.jodconverter.local.LocalConverter;
import org.jodconverter.local.office.LocalOfficeManager;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

@Configuration
@Profile("worker")
@ConditionalOnProperty(prefix = "app.preview", name = "enabled", havingValue = "true", matchIfMissing = true)
public class DocumentPreviewConverterConfig {
    @Bean(initMethod = "start", destroyMethod = "stop")
    LocalOfficeManager localOfficeManager(DocumentPreviewProperties properties) {
        LocalOfficeManager.Builder builder = LocalOfficeManager.builder()
                .processTimeout(properties.timeout().toMillis())
                .taskExecutionTimeout(properties.timeout().toMillis())
                .maxTasksPerProcess(properties.maxTasksPerProcess());
        if (properties.officeHome() != null && !properties.officeHome().isBlank()) {
            builder.officeHome(properties.officeHome());
        }
        return builder.build();
    }

    @Bean
    DocumentConverter documentConverter(LocalOfficeManager officeManager) {
        return LocalConverter.builder().officeManager(officeManager).build();
    }
}
