import {
  Report,
  ReportInputDto,
  ReportDto,
  ReportDtoWithCurrentStatus,
  ReportForAdminDto,
  ReportForAdminWithoutObservablesDto
} from "../models/report";
import {UserDataService} from "../../auth/services/user-data.service";
import {CategoryService} from "../services/category.service";
import {StatusUpdateService} from "../services/status-update.service";
import {filter, mergeMap, take, tap} from "rxjs/operators";
import {from, of} from "rxjs";
import {Status} from "../models/status";
import {DocumentSnapshot} from "@angular/fire/firestore";
import * as firebase from "firebase/app";
import {DocumentReferenceService} from "../services/document-reference.service";

export class ReportMapper {
  public static reportToReportDto(report: Report, userDataService: UserDataService, categoryService: CategoryService): ReportDto {
    return {
      id: report.id,
      category: categoryService.getCategoryById(report.category.id),
      user: userDataService.getUserData(report.user.id),
      dateSubmitted: report.dateSubmitted,
      location: report.location,
      locationDescription: report.locationDescription,
      note: report.note,
      picture: report.picture,
    };
  }

  public static addCurrentStatusToReportDto(report: ReportDto, statusUpdateService: StatusUpdateService): ReportDtoWithCurrentStatus {
    return {
      currentStatus: statusUpdateService.getLastStatusUpdateByReportId(report.id)
        .pipe(
          filter(statusUpdate => statusUpdate !== undefined),
          mergeMap(statusUpdate => from(statusUpdate.status.get())),
          mergeMap((ds: DocumentSnapshot<Status>) => of(ds.data() as Status))
        ),
      ...report
    };
  }

  public static reportDtoToReport(reportDto: ReportInputDto, docRefService: DocumentReferenceService) {
    return {
      user: docRefService.getUserDataReference(reportDto.userId),
      category: docRefService.getCategoryReference(reportDto.categoryId),
      location: {
        address: reportDto.location.address,
        mapsUrl: reportDto.location.mapsUrl,
        coords: new firebase.firestore.GeoPoint(reportDto.location.lat, reportDto.location.long)
      },
      locationDescription: reportDto.locationDescription,
      note: reportDto.note,
      picture: reportDto.picture,
      dateSubmitted: firebase.firestore.Timestamp.now()
    };
  }

  public static reportWithCurrentStatusToReportForAdmin(report: ReportDtoWithCurrentStatus): ReportForAdminDto {
    return {
      id: report.id,
      category: report.category,
      user: report.user,
      dateSubmitted: report.dateSubmitted.toDate(),
      currentStatus: report.currentStatus
    };
  }

  public static reportForAdminDtoToReportForAdminWithoutObservablesDto(report: ReportForAdminDto) {
    let newReport = {id: report.id, dateSubmitted: report.dateSubmitted.toLocaleString()};
    report.user.pipe(take(1)).subscribe(user => newReport['userEmail'] = user.email);
    report.currentStatus.pipe(take(1)).subscribe(status => newReport['currentStatusName'] = status.name);
    report.category.pipe(take(1)).subscribe(category => newReport['categoryName'] = category.name);
    return newReport as ReportForAdminWithoutObservablesDto;
  }
}
